"use strict";

const IncompatibleProtocolVersion = require("../protocol/IncompatibleProtocolVersion.js");
const OfflineMessage = require("../protocol/OfflineMessage.js");;
const OpenConnectionReply1 = require("../protocol/OpenConnectionReply1.js");
const OpenConnectionReply2 = require("../protocol/OpenConnectionReply2.js");
const OpenConnectionRequest1 = require("../protocol/OpenConnectionRequest1.js");
const OpenConnectionRequest2 = require("../protocol/OpenConnectionRequest2.js");
const UnconnectedPing = require("../protocol/UnconnectedPing.js");
const UnconnectedPingOpenConnections = require("../protocol/UnconnectedPingOpenConnections.js");
const UnconnectedPong = require("../protocol/UnconnectedPong.js");

class OfflineMessageHandler {
  constructor(manager, binarystream) {
    this.sessionManager = manager;
    this.packetPool;
    
    this.BinaryStream = binarystream;
    
    this.registerPackets();
  }
  
  handleRaw(payload, address) {
    if (payload.buffer === "") return false; //FETCH VALUES IN BUFFER.
    
    let pk = this.getPacketFromPool(payload);
    
    if (pk === null) return false;
    
    if (typeof pk === "undefined") {
      return;
    } else {
      pk.decode();
    }
    
    if (!pk.isValid()) return false;
    
    if (!pk.feof()) {
      let remains = substring(pk.getBuffer(), pk.getOffset());
      this.sessionManager.getLogger().debug(`Still ${remains.length} bytes unread in ${pk} from ${address}`);
    }
    return this.handle(pk, address);
  }
  
  handle(packet, address) {
    if (packet instanceof UnconnectedPing) {
      let pk = new UnconnectedPong();
      pk.serverId = thid.sessionManager.getID();
      pk.sendPingTime = packet.sendPingTime;
      pk.serverName = this.sessionManager.getName();
      this.sessionManager.sendPacket(pk, address);
    } else if (packet instanceof OpenConnectionRequest1) {
      let serverProtocol = this.sessionManager.getProtocolVersion();
      if (packet.protocol !== serverProtocol) {
        let pk = new IncompatibleProtocolVersion();
        pk.protocolVersion = serverProtocol;
        pk.serverId = this.sessionManager.getID();
        this.sessionManager.sendPacket(pk, address);
        this.sessionManager.getLogger().debug(`Refused connection from ${address} due to incompatible RakNet protocol version (expected ${serverProtocol}, got ${packet.protocol})`);
      } else {
        let pk = new OpenConnectionReply1();
        pk.mtuSize = packet.mtuSize + 28;
        pk.serverId = this.sessionManager.getID();
        this.sessionManager.sendPacket(pk, address);
      }
    } else if (packet instanceof OpenConnectionRequest2) {
      if (packet.serverAddress.port === this.sessionManager.getPort() || !this.sessionManager.portChecking) {
        if (packet.mtuSize < Session.MIN_MTU_SIZE) {
          this.sessionManager.getLogger().debug(`Not creating session for ${address} due to bad MTU size ${packet.mtuSize}`);
          return true;
        }
        let mtuSize = Math.min(packet.mtuSize, this.sessionManager.getMaxMtuSize());
        
        let pk = new OpenConnectionReply2();
        pk.mtuSize = mtuSize;
        pk.serverId = this.sessionManager.getID();
        pk.clientAddress = address;
        this.sessionManager.sendPacket(pk, address);
        this.sessionManager.createSession(address, packet.clientID, mtuSize);
      } else {
        this.sessionManager.getLogger().debug(`Not creating session for ${address} due to mismatched port, expected ${this.sessionManager.getPort()}, got ${packet.serverAddress.port}`);
      }
    } else {
      return false;
    }
    
    return true;
  }
  
  registerPacket(id, clss) {
    this.packetPool.set(id, clss);
  }
  
  getPacketFromPool(stream) {
    const pk = this.packetPool.get(stream.readByte());
    
    if (typeof pk !== "undefined") {
      if (pk !== null) {
        let pkt = pk;
        pkt.buffer = stream.buffer;
        return pkt;
      }
      
      return null;
    } else {
      
      return undefined;
    }
  }
  
  registerPackets() {
    this.packetPool = new Map();
    
    let UPing = new UnconnectedPing();    
    this.registerPacket(UPing.ID, UPing);
   
    let UPingOC = new UnconnectedPingOpenConnections();
    this.registerPacket(UPingOC.ID, UPingOC);
    
    let OCR1 = new OpenConnectionRequest1();
    this.registerPacket(OCR1.ID, OCR1);
    
    let OCR2 = new OpenConnectionRequest2();
    this.registerPacket(OCR2.ID, OCR2);
  }
}

module.exports = OfflineMessageHandler;