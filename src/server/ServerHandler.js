"use strict";

const BinaryStream = require("nodebe-binarystream");

const EncapsulatedPacket = require("../protocol/EncapsulatedPacket.js");
const ITCProtocol = require("./ITCProtocol.js");

const RakNet = require("../NodeBERakNet.js");

class ServerHandler {
  constructor(server, instance, binarystream) {
    this.server = server;
    this.instance = instance;
    
    this.binarystream = binarystream;
  }
  
  sendEncapsulated(identifier, packet, flags = RakNet.PRIORITY_NORMAL) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_ENCAPSULATED) + this.binarystream.writeInt(identifier) + String.fromCharCode(flags) + packet.toInternalBinary();
    
    this.server.pushMainToThreadPacket(buffer);
  }
  
  sendRaw(address, port, payload) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_RAW) + String.fromCharCode(address.length) + address + this.binarystream.writeShort(port) + payload;
    
    this.server.pushMainToThreadPacket(buffer);
  }
  
  closeSession(identifier, reason) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_CLOSE_SESSION) + this.binarystream.writeInt(identifier) + String.fromCharCode(reason.length) + reason;
    
    this.server.pushMainToThreadPacket(buffer);
  }
  
  sendOption(name, value) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_SET_OPTION) + String.fromCharCode(name.length) + name + value;
    
    this.server.pushMainToThreadPacket(buffer);
  }
  
  blockAddress(address, timeout) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_BLOCK_ADDRESS) + String.fromCharCode(address.length) + address + this.binarystream.writeInt(timeout);
    
    this.server.pushMainToThreadPacket(buffer);
  }
  
  unblockAddress(address) {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_UNBLOCK_ADDRESS) + String.fromCharCode(address.length) + address;
    
    this.server.pushMainToThreadPacket($buffer)
  }
  
  addRawPacketFilter(regex) {
    this.server.pushMainToThreadPacket(String.fromCharCode(ITCProtocol.PACKET_RAW_FILTER) + regex);
  }
  
  shutdown() {
    let buffer = String.fromCharCode(ITCProtocol.PACKET_SHUTDOWN);
    this.server.pushMainToThreadPacket(buffer);
    this.server.shutdown();
    this.server.join();
  }
  
  emergencyShutdown() {
    this.server.shutdown();
    this.server.pushMainToThreadPacket(String.fromCharCode(ITCProtocol.PACKET_EMERGENCY_SHUTDOWN));
    
  }
  
  handlePacket() {
    let packet = this.server.readThreadToMainPacket();
    if (packet !== null && typeof packet !== "undefined") {
      let id = packet[0].charCodeAt();
      let offset = 1;
      if (id === ITCProtocol.PACKET_ENCAPSULATED) {
        let identifier = BinaryStream.readInt(packet.substr(offset, 4));
        offset += 4;
        let flagd = packet[offset++].charCodeAt();
        let buffer = packet.substr(offset);
        this.instance.handleEncapsulated(identifier, EncapsulatedPacket.fromInternalBinary(buffer), flags);
      } else if (id === ITCProtocol.PACKET_RAW) {
        let len = packet[offset++].charCodeAt();
        let address = packet.substr(offset, len);
        offset += len;
        let port = Binary.readShort(packet.substr(offset, 2));
        offset += 2;
        let payload = packet.substr(offset);
        this.instance.handleRaw(address, port, payload);
      } else if(id === ITCProtocol.PACKET_SET_OPTION) {
        let len = packet[offset++].charCodeAt();
        let name = packet.substr(offset, len);
        offset += len;
        let value = packet.substr(offset);
        this.instance.handleOption(name, value);
      } else if (id === ITCProtocol.PACKET_OPEN_SESSION) {
        let identifier = BinaryStream.readInt(packet.substr(offset, 4));
        offset += 4;
        let len = packet[offset++].charCodeAt();
        let address = packet.substr(offset, len);
        offset += len;
        let port = BinaryStream.readShort(packet.substr(offset, 2));
        offset += 2;
        let clientID = BinaryStream.readLong(packet.substr(offset, 8));
        this.instance.openSession(identifier, address, port, clientID);
      } else if (id === ITCProtocol.PACKET_CLOSE_SESSION) {
        let identifier = BinaryStream.readInt(packet.substr(offset, 4));
        offset += 4;
        let len = packet[offset++].charCodeAt();
        let reason = packet.substr(offset, len);
        this.instance.closeSession(identifier, reason);
      } else if (id === ITCProtocol.PACKET_INVALID_SESSION) {
        let identifier = BinaryStream.readInt(packet.substr(offset, 4));
        this.instance.closeSession(identifier, "Invalid session.");
      } else if (id === ITCProtocol.PACKET_ACK_NOTIFICATION) {
        let identifier = BinaryStream.readInt(packet.substr(offset, 4));
        offset += 4;
        let identifierACK = BinaryStream.readInt(packet.substr(offset, 4));
        this.instance.notifyACK(identifier, identifierACK);
      } else if (id === ITCProtocol.PACKET_REPORT_PING) {
        let identifier = BinaryStream.readInt(packet.substr(offset, 4));
        offset += 4;
        let pingMS = BinaryStream.readInt(packet.substr(offset, 4));
        this.instance.updatePing(identifier, pingMS);
      }
      
      return true;
    }
    
    return false;
  }
}

module.exports = ServerHandler;