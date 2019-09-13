"use strict";

const binarystream = require("nodebe-binarystream");

const Packet = require("../protocol/Packet.js");
const EncapsulatedPacket = require("../protocol/EncapsulatedPacket.js");
const Datagram = require("../protocol/Datagram.js");
const ACK = require("../protocol/ACK.js");
const NACK = require("../protocol/NACK.js");

const OfflineMessageHandler = require("./OfflineMessageHandler.js");

const ITCProtocol = require("./ITCProtocol.js");

const RakNet = require("../NodeBERakNet.js");

const Session = require("./Session.js");

class SessionManager {
  constructor(server, socket, maxMtuSize) {
    this.RAKNET_TPS = 100;
    this.RAKNET_TIME_PER_TICK = 1 / this.RAKNET_TPS;
    
    this.server = server;
    this.socket = socket;
    
    this.binarystream = new binarystream();
    
    this.maxMtuSize = maxMtuSize;
    
    this.startTimeMS = Date.now();
    
    this.offlineMessageHandler = new OfflineMessageHandler(this);
    
    this.reuseableAddress = this.socket.getBindAddress();
    
    this.recieveBytes = 0;
    this.sendBytes = 0;
    
    this.sessionsByAddress = new Map();
    
    this.sessions = new Map();
    
    this.name = [
      "MCPE",
      "NODEBE TEST SERVER",
      361,
      "1.12.0",
      0,
      20,
      this.getID(),
      "NODEBE TEST SERVER",
      "SURVIVAL"
    ].join(";") + ";";
      
      /*[
            "MCPE",
            this.motd,
            this.protocol,
            this.version,
            this.players.online,
            this.players.max,
            this.serverId,
            this.name,
            this.gamemode
        ]*/  
    
    this.packetLimit = 200;
    
    this.shutdown = false;
    
    this.ticks = 0;
    this.lastMeasure;
    
    this.block = new Map();
    this.ipSec = new Map();
    
    this.rawPacketFilters = new Map();
    
    this.portChecking = false;
    
    this.nextSessionId = 0;
    
    this.socket.getSocket().on("listening", () => {
      let address = this.socket.getSocket().address();
      this.getLogger().log(`RakNetServer listening on ${address.address}:${address.port}`);
    })
    
    this.socket.getSocket().on("message", (msg, rinfo) => {
        this.getLogger().log(`MSG: ${msg} \n RINFO: ${JSON.stringify(rinfo)}`);
        
        this.socket.msg = msg;
        this.socket.rinfo = rinfo;
    });
    
    this.socket.getSocket().on("error", (err) => {
      this.getLogger().error(err.stack);
      this.socket.getSocket().close();
    });
  }
  
  getRakNetTimeMS() {
    return Number(Date.now() * 1000 - this.startTimeMS);
  }
  
  getPort() {
    return this.socket.getBindAddress().port;
  }
  
  getMaxMtuSize() {
    return this.maxMtuSize;
  }
  
  getProtocolVersion() {
    return this.server.getProtocolVersion();
  }
  
  getLogger() {
    return this.server.getLogger();
  }
  
  run() {
    this.tickProcessor();
  }
  
  tickProcessor() {
    this.lastMeasure = Date.now();
    
    let tick = setInterval(() => {
      if (!this.shutdown) {
        let start = Date.now();
        
        let i;
        
        for (let stream = true, i = 0; i < 100 && stream && !this.shutdown; ++i) {
          stream = this.recieveStream();
        }
        
        for (let socket = true, i = 0; i < 100 && socket && !this.shutdown; ++i) {
          socket = this.recievePacket();
        }
        
        this.tick();
      } else {
        clearInterval(tick);
      }
    }, this.RAKNET_TIME_PER_TICK * 1000);
  }
  
  tick() {
    let time = Date.now();
    for (let session in this.sessions.keys()) {
      if (this.sessions.size > 1) {
        console.log(this.sessions.size)
        session.update(time);
     }
    }
    
    this.ipSec = new Map();
    
    if ((this.ticks & this.RAKNET_TPS) === 0) {
      if (this.sendBytes > 0 || this.recieveBytes > 0) {
        let diff = Math.max(0.005, time - this.lastMeasure)
        
        let bandwidth = {
          up: this.sendBytes / diff,
          down: this.recieveBytes / diff
        };
        this.streamOption("bandwidth", bandwidth);
				
				this.sendBytes = 0;
				this.recieveBytes = 0;
      }
      this.lastMeasure = time;
      
      if (this.block.length > 0) {
        //asort(this.block);
        let now = Date.now();
        for (let timeout in this.block) {
          if (timeout <= now) {
            for (let address in this.block)
            this.block.delete(address);
          } else {
            break;
          }
        }
      }
    }
    ++this.ticks;
  }
  
  recievePacket() {
    let msg = this.socket.msg;
    
    if (typeof msg !== "undefined") {
      this.binarystream.writeData(msg);
      this.socket.msg = undefined;
    } else {
      this.binarystream.reset();
    }
    
    if (typeof msg !== "undefined" && msg.length !== 33) {
      console.log(msg);
    }
       
    let stream = this.binarystream;
    
    let address = this.socket.rinfo;
    if (typeof address === "object" && typeof address.address !== "undefined") {
      address.ip = address.address;
      address.version = Number(address.family.replace("IPv", ""));
    } else {
      address = this.reuseableAddress;
    }
    
    let len = stream.buffer.length;
    
    stream.pid = stream.getBuffer()[0];
    
    this.recieveBytes += len;
    
    if(this.block.has(address.ip)) return true;
    
    if (this.ipSec.has(address.ip)) {
      if (++this.ipSec.get(address.ip) >= this.packetLimit) {
        this.blockAddress(address.ip);
        return true;
      }
    } else {
      this.ipSec.set[address.ip, 1];
    }
    
    if (len < 1) return;
    
    try {
      let session = this.getSessionByAddress(address.ip);
      
      if (session !== null) {
        let header = stream.pid;
        if ((header & Datagram.BITFLAG_VALID) !== 0) {
          console.log("VALID HEAD");
          if (header & Datagram.BITFLAG_ACK) {
            console.log("VALID ACK");
            session.handlePacket(new ACK(buffer));
          } else if (header & Datagram.BITFLAG_NAK) {
            console.log("VALID NAK");
            session.handlePacket(new NACK(buffer));
          } else {
            console.log("VALID DGRAM");
            session.handlePacket(new Datagram(buffer));
          }
        } else {
          this.getLogger().debug(`Ignored unconnected packet from ${address.ip}:${address.port} [v${address.version}] due to session already opened (0x${stream.pid})`);
        }
      } else if (this.offlineMessageHandler.handleRaw(stream, address)) {
        let handled = false;
        
        for (pattern in this.rawPacketFilters) {
          console.log(pattern);
          let regexpStream = new RegExp(stream);
          if (regexpStream.match(pattern)) {
            handled = true;
            this.streamRaw(address, stream);
            break;
          }
        }
        
        if (!handled) {
          this.getLogger().debug(`Ignored packet from ${address.ip}:${address.port} [v${address.version}] due to no session opened (0x${stream.pid})`);
        }
      }
    } catch (error) {
      this.getLogger().error(error);
      // IMPLEMENT A PROPER ERROR SYSTEM.
      
      console.log(this.binarystream);
      process.exit(1);
      this.blockAddress(address.ip, 5);
    }
    
    return true;
  }
  
  sendPacket(packet, address) {
    console.log("Send Packet:");
    console.log(packet);
    packet.encode();
    console.log("Send Encoded Packet:");
    console.log(packet);
    
    try {
      this.sendBytes += this.socket.writePacket(packet.getBuffer(), address.ip, address.port);
    } catch (error) {
      this.getLogger().debug(error);
    }
  }
  
  streamEncapsulated(session, packet, flags = RakNet.PRIORITY_NORMAL) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_ENCAPSULATED) + this.binarystream.writeInt(session.getInternalId) + String.fromCharCode(flags) + packet.toInternalBinary();
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  streamRaw(source, payload) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_RAW) + String.fromCharCode(source.ip.length) + source.ip + this.binarystream.writeShort(source.port) + payload;
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  streamClose(identifier, reason) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_CLOSE_SESSION) + this.binarystream.writeInt(identifier) + String.fromCharCode(reason.length) + reason;
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  streamInvalid(identifier) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_INVALID_SESSION) + this.binarystream.writeInt(identifier);
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  streamOpen(session) {
    let address = session.getAddress();
    
    this.getLogger.debug(address);
    
    let buffer = String.fromCharCode(ITCProtocol.PACKET_OPEN_SESSION) + this.binarystream.writeInt(session.getInternalId()) + String.fromCharCode(address.ip.length) + address.ip + this.binarystream.writeShort(address.port) + this.binarystream.writeLong(session.getID());
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  streamACK(identifier, identifierACK) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_ACK_NOTIFICATION) + this.binarystream.writeInt(identifier) + this.binarystream.writeInt(identifierACK);
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  streamOption(name, value) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_SET_OPTION) + String.fromCharCode(name.length) + name + JSON.stringify(value);    
    this.server.pushThreadToMainPacket(buffer);
  } 
  
  streamPingMeasure(session, pingMS) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_REPORT_PING) + this.binarystream.writeInt(session.getInternalId()) + this.binarystream.writeInt(pingMS);
    
    this.server.pushThreadToMainPacket(buffer);
  }
  
  recieveStream() {
    if (typeof this.binarystream === "undefined") return;
    
    let packet = this.server.readMainToThreadPacket();
    if(packet !== null) {
      let id = 0;
      let offset = this.binarystream.offset;
      offset = 1;
      if (id === ITCProtocol.PACKET_ENCAPSULATED) {
        let identifier = this.binarystream.readInt();
        offset += 4;
        let session = this.sessions.get(identifier) || null;
        if (session !== null && session.isConnected()) {
          let flags;
          let buffer = this.binarystream.buffer;
          session.addEncapsulatedToQueue(EncapsulatedPacket.fromInternalBinary(buffer), flags);
        } else {
          this.streamInvalid(identifier);
        }
      } else if (id === ITCProtocol.PACKET_RAW) {
        let len = packet[offset++].charCodeAt();
        let address = packet.substring(offset, len);
        offset += len;
        let port = this.binarystream.readShort(packet.substring(offset, 2));
        offset += 2;
        let payload = String.prototype.substring($packet, $offset);
        
        try {
          this.socket.writePacket(payload, address, port)
        } catch (error) {
          this.getLogger().debug(error);
        }
      } else if (id === ITCProtocol.PACKET_CLOSE_SESSION) {
        let identifier = this.binarystream.readInt(packet.substring(offset, 4));
        if (this.sessions.has(identifier)) {
          this.sessions.get(identifier).flagForDisconnection();
        } else {
          this.streamInvalid(identifier);
        }
      } else if (id === ITCProtocol.PACKET_INVALID_SESSION) {
        let identifier = this.binarystream.readInt(packet.substring(offset, 4));
        if (this.sessions.has(identifier)) {
          this.removeSession(this.sessions.get(identifier));
        }
      } else if (id === ITCProtocol.PACKET_SET_OPTION) {
        let len = packet[offset++].charCodeAt();
        let name = packet.substring(offset, len);
        offset += len;
        let value = packet.substring(offset);
        
        switch (name) {
          case "name":
          this.name = value;
          break;
          
          case "portChecking":
          this.portChecking = value;
          break;
          
          case "packetLimit":
          this.packetLimit = value;
          break;
        }
      } else if (id === ITCProtocol.PACKET_BLOCK_ADDRESS) {
        let len = packet[offset++].charCodeAt();
        let address = packet.substring(offset, len);
        offset += len;
        let timeout = this.binarystream.readInt(packet.substring(offset, 4));
        this.blockAddress(address, timeout);
      } else if (id === ITCProtocol.PACKET_UNBLOCK_ADDRESS) {
        let len = packet[offset++].charCodeAt();
        let address = packet.substring(offset, len);
        this.unblockAddress(address);
      } else if (id === ITCProtocol.PACKET_RAW_FILTER) {
        let pattern = packet.substring(offset);
        this.rawPacketFilters = pattern;
      } else if (id === ITCProtocol.PACKET_SHUTDOWN) {
        for (session of this.sessions) {
          this.removeSession(session);
        }
        
        this.socket.close();
        this.shutdown = true;
      } else if (id === ITCProtocol.PACKET_EMERGENCY_SHUTDOWN) {
        this.shutdown = true;
      } else if (id === 0) {
        return;
      }
      else {
        this.getLogger().debug(`Unknown RakLib internal packet (ID 0x${id.toString(16)} received from main thread`);
      }
           
      return true;
    }
    
    return false;
  }
  
  blockAddress(address, timeout = 300) {
    let final = Date.now() + timeout;
    
    if (!this.block.has(address) || timeout !== 1) {
      if (timeout === -1) {
        final = Number.MAX_SAFE_INTEGER;
      } else {
        this.getLogger().notice(`Blocked ${address} for ${timeout} seconds.`);
      }
      this.blockAddress[address] = final;
    } else if (this.block.get(address) < final) {
      this.block.set(address, final);
    }
  }
  
  unblockAddress(address) {
    this.block.delete(address);
    this.getLogger().debug(`Unblocked ${address}`);
  }
  
  getSessionByAddress(address) {
    return this.sessionsByAddress.get(address.toString()) || null;
  }
  
  sessionExists(address) {
    return this.sessionsByAddress.has(address.toString());
  }
  
  createSession(address, logger, clientId, mtuSize) {
    this.checkSessions();
    
    while(this.sessions.has(this.nextSessionId)) {
      this.nextSessionId++;
      this.nextSessionId &= 0x7fffffff;
    }
    
    let session = new Session(this, logger, address, clientId, mtuSize, this.nextSessionId);
    
    this.sessionsByAddress.set(address.ip, session);
    this.sessions.set(this.nextSessionId, session);
    this.getLogger().debug(`Created session for ${address.ip} with MTU size ${mtuSize}`);
    
    return session;
  }
  
  removeSession(session, reason = "unknown") {
    let id = session.getInternalId();
    if (this.sessions.has(id)) {
      this.sessions.get(id).close();
      this.removeSessionInternal(session);
      this.streamClose(id, reason);
    }
  }
  
  removeSessionInternal(session) {
    this.sessionsByAddress.delete(session.getAddress().ip);
    this.sessions.delete(session.getInternalId());   
  }
  
  openSession(session) {
    this.streamOpen(session);
  }
  
  checkSessions() {
    if(this.sessions.size > 4096) {
      for (session of this.sessions) {
        if (session.isTemporal()) {
          this.removeSessionInternal(session);
          if (this.sessions.size <= 4096) {
            break;
          }
        }
      }
    }
  }
  
  notifyACK(session, identifierACK) {
    this.streamACK(session.getInternalId(), identifierACK);
  }
  
  getName() {
    return this.name;
  }
  
  getID() {
    return this.server.getServerId();
  }
}

module.exports = SessionManager;