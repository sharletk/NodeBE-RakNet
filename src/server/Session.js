"use strict";

const ACK = require("../protocol/ACK.js");
const ConnectedPing = require("../protocol/ConnectedPing.js");
const ConnectedPong = require("../protocol/ConnectedPong.js");
const ConnectionRequest = require("../protocol/ConnectionRequest.js");
const ConnectionRequestAccepted = require("../protocol/ConnectionRequestAccepted.js");
const Datagram = require("../protocol/Datagram.js");
const DisconnectionNotification = require("../protocol/DisconnectionNotification.js");
const EncapsulatedPacket = require("../protocol/EncapsulatedPacket.js");
const MessageIdentifiers = require("../protocol/MessageIdentifiers.js");
const NACK = require("../protocol/NACK.js");
const NewIncomingConnection = require("../protocol/NewIncomingConnection.js");
const Packet = require("../protocol/Packet.js");
const PacketReliability = require("../protocol/PacketReliability.js");

const RakNet = require("../NodeBERakNet.js");

const Methods = require("nodebe-methods");

class Session {
  constructor(sessionManager, logger, address, clientId, mtuSize, internalId) {
    if(mtuSize < this.MIN_MTU_SIZE) {
      throw new Error(`MTU Size must be atleast ${this.MIN_MTU_SIZE}, got ${mtuSize}`);
    }
    
    this.STATE_CONNECTING = 0;
    this.STATE_CONNECTED = 1;
    this.STATE_DISCONNECTING = 2;
    this.STATE_DISCONNECTED = 4;
    
    this.MIN_MTU_SIZE = 400;
    
    this.MAX_SPLIT_SIZE = 128;
    this.MAX_SPLIT_COUNT = 4;
    
    this.CHANNEL_COUNT = 32;
    
    this.WINDOW_SIZE = 2048;
    
    this.messageIndex = 0;
    
    this.state = this.STATE_CONNECTING;
    this.splitID = 0;
    
    this.sendSeqNumber = 0;
    
    this.disconnectionTime;
    
    this.isTemporal = true;
    
    this.packetToSend = new Map();
    this.isActive = false;
    
    this.ACKQueue = new Map();
    this.NACKQueue = new Map();
    
    this.recoveryQueue = new Map();
    
    this.splitPackets = new Map();
    
    this.needACK = new Map();
    
    this.highestSeqNumber = -1;
    
    this.lastPingTime = -1;
    this.lastPingMeasure = 1;
    
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.address = address;
    this.id = clientId;
    this.mtuSize = mtuSize;
    this.internalId = internalId;
    
    this.sendQueue = new Datagram();
    
    this.lastUpdate = Date.now();
    this.windowStart = 0;
    this.windowEnd = this.WINDOW_SIZE;
    
    this.reliableWindowStart = 0;
    this.reliableWindowEnd = this.WINDOW_SIZE;
    this.reliableWindow = new Map();
    
    this.sendOrderedIndex = new Array().fill(0, this.CHANNEL_COUNT, 0);
		this.sendSequencedIndex = new Array().fill(0, this.CHANNEL_COUNT, 0);

		this.receiveOrderedIndex = new Array().fill(0, this.CHANNEL_COUNT, 0);
		this.receiveSequencedHighestIndex = new Array().fill(0, this.CHANNEL_COUNT, 0);

		this.receiveOrderedPackets = new Array().fill(0, this.CHANNEL_COUNT, []);
  }
  
  getInternalId() {
    return this.internalId;
  }
  
  getAddress() {
    return this.address;
  }
  
  getID() {
    return this.id;
  }
  
  getState() {
    return this.state;
  }
  
  isTemporal() {
    return this.isTemporal;
  }
  
  isConnected() {
    return this.state !== this.STATE_DISCONNECTING && this.state !== this.STATE_DISCONNECTED;
  }
  
  update(time) {
    if (!this.isActive && (this.lastUpdate + 10) < time) {
      this.disconnect("timeout");
      
      return;
    }
    
    //finish
  }
  
  disconnect(reason = "unknown") {
    this.sessionManager.removeSession(this, reason);
  }
  
  sendDatagram(datagram) {
    if(datagram.seqNumber !== null) {
      this.recoveryQueue.delete(datagram.seqNumber);
    }
    datagram.seqNumber = this.sendSeqNumber++;
    datagram.sendTime = Date.now();
    this.recoveryQueue.set(datagram.seqNumber, datagram);
    this.sendPacket(datagram);
  }
  
  queueConnectedPacket(packet, reliability, orderChannel, flags = RakNet.PRIORITY_NORMAL) {
    packet.encode();
    
    let encapsulated = new EncapsulatedPacket();
    encapsulated.reliability = reliability;
    encapsulated.orderChannel = orderChannel;
    encapsulated.buffer = packet.getBuffer();
    
    this.addEncapsulatedToQueue(encapsulated, flags);
  }
  
  sendPacket(packet) {
    this.sessionManager.sendPacket(packet, this.address);
  }
  
  sendQueue() {
    if(this.sendQueue.packets.length > 0) {
      this.sendDatagram(this.sendQueue);
      this.sendQueue = new Datagram();
    }
  }
  
  sendPing(reliability = PacketReliability.UNRELIABLE) {
    let pk = new ConnectedPing();
    pk.sendPingTime = this.sessionManager.getRakNetTimeMS();
    this.queueConnectedPacket(pk, reliability, 0, RakNet.PRIORITY_IMMEDIATE)
  }
  
  addToQueue(pk, flags = RakNet.PRIORITY_NORMAL) {
    let priority = flags & 0b00000111;
    if (pk.needACK && pk.messageIndex !== null) {
      this.needACK.get(pk.identifierACK)[pk.messageIndex] = pk.messageIndex;
    }
    
    let length = this.sendQueue.__length();
    if (length + pk.getTotalLength() > this.mtuSize - 36) {
      this.sendQueue();
    }
    
    if (pk.needACK) {
      this.sendQueue.packets = pk;
      pk.needACK = false;
    } else {
      this.sendQueue.packets = pk.toBinary();
    }
    
    if (priority === RakNet.PRIORITY_IMMEDIATE) {
      this.sendQueue();
    }
  }
  
  addEncapsulatedToQueue(packet, flags = RakNet.PRIORITY_NORMAL) {
    if ((packet.needACK = (flags & RakNet.FLAG_NEED_ACK) > 0) === true) {
      this.needACK.get(packet.identifierACK) = [];
    }
    
    if (new PacketReliability().isOrdered(packet.reliability)) {
      packet.orderIndex = this.sendOrderedIndex[packet.orderChannel]++;
    } else if (new PacketReliability().isSequenced(packet.reliability)) {
      packet.orderIndex = this.sendOrderedIndex[packet.orderIndex];
      packet.sequenceIndex = this.sendSequencedIndex[packet.orderChannel]++;
    }
    let maxSize = this.mtuSize - 60;
    
    if (packet.buffer.length > maxSize) {
      let buffers = String.split(packet.buffer, maxSize);
      let bufferCount = buffers.length;
      
      let splitID = ++this.splitID & 65536;
      for (buffer of buffers) {
        let pk = new EncapsulatedPacket();
        pk.splitID = splitID;
        pk.hasSplit = true;
        pk.splitCount = bufferCount;
        pk.reliability = packet.reliability;
        pk.splitIndex = count;
        pk.buffer = buffer;
        
        if (new PacketReliability().isReliable(pk.reliability)) {
          pk.messageIndex = this.messageIndex++;
        }
        
        pk.sequenceIndex = packet.sequenceIndex;
        pk.orderChannel = packet.orderChannel;
        pk.orderIndex = packet.orderIndex;
        
        this.addToQueue(pk, flags | RakNet.PRIORITY_IMMEDIATE);
      }
    } else {
      if (new PacketReliability().isReliable(packet.reliability)) {
        packet.messageIndex = this.messageIndex++;
      }
      this.addToQueue(packet, flags);
    }
  }
  
  handleSplit(packet) {
    if (packet.splitCount >= this.MAX_SPLIT_SIZE || packet.splitIndex >= this.MAX_SPLIT_SIZE || packet.splitIndex < 0) {
      this.logger.debug(`Invalid split packet part from ${this.address}, too many parts or invalid split index (part index ${packet.splitIndex}, part count ${packet.splitCount})`);
      return null;
    }
    
    if (!(this.splitPackets.has(packet.splitID))) {
      if ((this.splitPackets.length) >= this.MAX_SPLIT_COUNT) {
        this.logger.debug(`Ignored split packet part from ${this.address} because reached concurrent split packet limit of ${this.MAX_SPLIT_COUNT}`);
        return null;
      }
      this.splitPackets.set(packet.splitID, (packet.splitIndex.map(packet => `${packet}`)));
    } else {
      this.splitPackets.set(packet.splitID, (packet.splitIndex.map(packet => `${packet}`)));
    }
    
    if ((this.splitPackets.get(packet.splitID).length) === packet.splitCount) {
      let pk = new EncapsulatedPacket();
      //pk.buffer = Buffer.alloc(0);
      
      pk.reliability = packet.reliability;
      pk.messageIndex = packet.messageIndex;
      pk.sequenceIndex = packet.sequenceIndex;
      pk.orderIndex = packet.orderIndex;
      pk.orderChannel = packet.orderChannel;
      
      for (i = 0; i < packet.splitCount; ++i) {
        pk.stream.writeData(this.splitPackets.get(packet.splitID)(i).buffer);
      }
      
      pk.length = pk.buffer.length;
      this.splitPackets.delete(packet.splitID);
      
      return pk;
    }
    
    return null;
  }
  
  handleEncapsulatedPacket(packet) {
    if (packet.messageIndex !== null) {
      if (packet.messageIndex < this.reliableWindowStart || packet.messageIndex > this.reliableWindowEnd || this.reliableWindow.has(packet.messageIndex)) return;
      
      this.reliableWindow.set(packet.messageIndex, true);
      
      if (packet.messageIndex === this.reliableWindowStart) {
        for (; this.reliableWindow.has(this.reliableWindowStart); ++this.reliableWindowStart) {
          this.reliableWindow.delete(this.reliableWindowStart);
          ++this.reliableWindowEnd;
        }
      }
    }
    
    if (packet.hasSplit && (packet = this.handleSplit(packet)) === null) return;
    
    if (PacketReliability.isSequencedOrOrdered(packet.reliability) && (packet.orderChannel < 0) || packet.orderChannel >= this.CHANNEL_COUNT) {
      this.sessionManager.getLogger().debug(`Invalid packet from ${this.address}, bad order channel (${packet.orderChannel})`);
      return;
    }
    
    if (PacketReliability.isSequenced(packet.reliability)) {
      if (packet.sequenceIndex < this.receiveSequencedHighestIndex[packet.orderChannel] || packet.orderIndex < this.receiveOrderedIndex[packet.orderChannel]) return;
      
      this.receiveSequencedHighestIndex[packet.orderChannel] = packet.sequenceIndex + 1;
      
      this.handleEncapsulatedPacketRoute(packet);
    } else if (PacketReliability.isOrdered(packet.reliability)) {
      if (packet.orderIndex === this.receiveOrderedIndex[packet.orderChannel]) {
        this.receiveSequencedHighestIndex[packet.orderIndex] = 0;
        this.receiveOrderedIndex[packet.orderChannel] = packet.orderIndex + 1;
        
        this.handleEncapsulatedPacketRoute(packet);
        
        for (let i = this.receiveOrderedIndex[packet.orderChannel]; Methods.Isset(this.receiveOrderedPackets[packet.orderChannel][i]); ++i) {
          this.handleEncapsulatedPacketRoute(this.receiveOrderedPackets[packet.orderChannel][i]);
          delete this.receiveOrderedPackets[packet.orderChannel][i];
        }
        
        this.receiveOrderedIndex[packet.orderChannel] = i;
      } else if (packet.orderIndex > this.receiveOrderedIndex[packet.orderChannel]) {
        this.receiveOrderedPackets[packet.orderChannel][packet.orderIndex] = packet;
      } else {
        //duplicate/already received packet
      }
    } else {
      //not ordered or sequenced
      this.handleEncapsulatedPacketRoute(packet);
    }
  }
    
  handleEncapsulatedPacketRoute(packet) {
    if (this.sessionManager === null) return;
    
    let id = packet.pid || packet.getBuffer()[0];
    
    if (id < MessageIdentifiers.ID_USER_PACKET_ENUM) {
      if (this.state === this.STATE_CONNECTING) {
        if (id === ConnectionRequest.ID) {
          let dataPacket = new ConnectionRequest(packet.getBuffer());
          dataPacket.decode();
          
          let pk = new ConnectionRequestAccepted();
          pk.address = this.address;
          pk.sendPingTime = dataPacket.sendPingTime;
          pk.sendPongTime = this.sessionManager.getRakNetTimeMS();
          this.queueConnectedPacket(pk, PacketReliability.UNRELIABLE, 0, RakNet.PRIORITY_IMMEDIATE);
        } else if (id === NewIncomingConnection.ID) {
          let dataPacket = new NewIncomingConnection(packet.getBuffer());
          dataPacket.decode();
          
          if (dataPacket.address.port === this.sessionManager.getPort() || !(this.sessionManager.portChecking)) {
            this.state = this.STATE_CONNECTED;
            this.isTemporal = false;
            this.sessionManager.openSession(this);
            
            this.sendPing();
          }
        }
      } else if (id === DisconnectionNotification.ID) {
        this.disconnect("client disconnect");
      } else if (id === ConnectedPing.ID) {
        let dataPacket = new ConnectedPing(packet.getBuffer());
        dataPacket.decode();
        
        let pk = new ConnectedPong();
        pk.sendPingTime = dataPacket.sendPingTime;
        pk.sendPongTime = this.sessionManager.getRakNetTimeMS();
        this.queueConnectedPacket(pk, PacketReliability.UNRELIABLE, 0);
      } else if (id === ConnectedPong.ID) {
        let dataPacket = new ConnectedPong(packet.getBuffer());
        dataPacket.decode();
        
        this.handlePong(dataPacket.sendPingTime, dataPacket.sendPongTime);
      }
    } else if (this.state === this.STATE_CONNECTED) {
      this.sessionManager.streamEncapsulated(this, packet);
    } else {
      this.logger.notice(`Received packet before connection: ${packet.getBuffer()}`);
    }
  }
  
  handlePong(sendPingTime, sendPongTime) {
    this.lastPingMeasure = this.sessionManager.getRakNetTimeMS().sendPingTime;
    this.sessionManager.streamPingMeasure(this, this.lastPingMeasure);
  }
  
  handlePacket(packet) {
    console.log("Handling Session Packet:");
    console.log(packet);
    
    this.isActive = true;
    this.lastUpdate = Date.now();
    
    if (!(packet instanceof Datagram)) {
      packet.decode();
      
      if (packet.seqNumber < this.windowStart || packet.seqNumber > this.windowEnd || this.ACKQueue.has(packet.seqNumber)) {
        this.logger.debug(`Received duplicate or out-of-window packet from ${this.address} (sequence number ${packet.seqNumber}, window ${this.windowStart} - ${this.windowEnd})`);
        
        return;        
      }
      
      this.NACKQueue.delete(packet.seqNumber);
      this.ACKQueue.set(packet.seqNumber, packet.seqNumber);
      
      if (this.highestSeqNumber < packet.seqNumber) {
        this.highestSeqNumber = packet.seqNumber;
      }
      
      if (packet.seqNumber === this.windowStart) {
        for (; this.ACKQueue.has(this.windowStart); ++this.windowStart) {
          ++this.windowEnd;
        }
      } else if (packet.seqNumber > this.windowStart) {
        for (let i = this.windowStart; i < packet.seqNumber; ++i) {
          if (!(this.ACKQueue.has(i))) {
            this.NACKQueue.set(i, i);
          }
        }
      } else {
      //assert(false, "received packet before window start");
      }
          
      for (pk of packet.packets) {
        this.handleEncapsulatedPacket(pk);
      }
    } else {
      if (packet instanceof ACK) {
        packet.decode();
        
        for (seq of packet.packets) {
          if (this.recoveryQueue.has(seq)) {
            for (pk of this.recoveryQueue.get(seq).packets) {
              if (pk instanceof EncapsulatedPacket && pk.needACK && pk.messageIndex !== null) {
                this.needACK.delete(pk.identifierACK);
                delete pk.messageIndex;
              }
            }
            this.recoveryQueue.delete(seq);
          }
        }
      } else if (packet instanceof NACK) {
        packet.decode();
        
        for (seq in packet.packets) {
          if (this.recoveryQueue.has(seq)) {
            this.packetToSend = this.recoveryQueue.get(seq);
            this.recoveryQueue.delete(seq);
          }
        }
      }
    }
  }
  
  flagForDisconnection() {
    this.state = this.STATE_DISCONNECTING;
    this.disconnectionTime = Date.now();
  }
    
  close() {
    if (this.state !== this.STATE_DISCONNECTING) {
      this.state = this.STATE_DISCONNECTED;
      
      this.queueConnectedPacket(new DisconnectionNotification(), PacketReliability.RELIABLE_ORDERED, 0, RakNet.PRIORITY_IMMEDIATE);
      
      this.logger.debug(`Closed session for ${this.address.ip}`);
      this.sessionManager.removeSessionInternal(this);
      this.sessionManager = null;
    }
  }
}

module.exports = Session;