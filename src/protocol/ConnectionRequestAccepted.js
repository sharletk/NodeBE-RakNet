"use strict"

const Packet = require("./Packet.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class ConnectionRequestAccepted extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIentifiers.ID_CONNECTION_REQUEST_ACCEPTED;
    
    this.address = {};
    this.systemAddress = [];
    this.sendPingTime;
    this.sendPongTime;
    
    this.systemAddress[0] = ["127.0.0.1", 0, 4];
  }
  
  encodePayload() {
    this.writeAddress(this.address.ip);
    this.writeShort(0);
    
    let dummy = {};
    dummy.ip = "0.0.0.0";
    dummy.port = 0;
    dummy.version = 4;
    
    let i;
    for(i = 0; i < 20; ++i) {
      this.writeAddress(this.systemAddress[i] ? dummy : null);
    }
    
    this.writeLong(this.sendPingTime);
    this.writeLong(this.sendPongTime);
  }
  
  decodePayload() {
    this.address = this.readAddress();
    this.readShort();
    
    let len = this.buffer.length;
    
    let dummy = {};
    dummy.ip = "0.0.0.0";
    dummy.port = 0;
    dummy.version = 4;
    
    let i;
    for(i = 0; i < 20; ++i) {
      this.systemAddress[i] = this.offset + 16 < len ? this.readAddress() : dummy;
    }
    
    this.sendPingTime = this.readLong();
    this.sendPongTime = this.readLong();
  }
}

module.exports = ConnectionRequestAccepted;