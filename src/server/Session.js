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
    
    this.packetToSend = [];
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