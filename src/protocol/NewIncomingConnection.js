"use strict"

const Packet = require("./Packet.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class NewIncomingConnection extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_NEW_INCOMING_CONNECTION;
    
    this.address = {};
    this.systemAddress = [];
    this.sendPingTime;
    this.sendPongTime;
    
    this.systemAddress[0] = ["127.0.0.1", 0, 4];
  }
  
  encodePayload() {
    this.writeAddress(this.address)
    for (address in this.systemAddress) {
      this.writeAddress(address);
    }
    this.writeLong(this sendPingTime);
    this.writeLong(this.sendPongTime);
  }
  
  decodePayload() {
    this.address = this.readAddress();
    
    let stopOffset = this.buffer.length - 16;
    
    let dummy = {};
    dummy.ip = "0.0.0.0";
    dummy.port = 0;
    dummy.version = 4;
      
    let i;
    for(i = 0; i < 20; ++i) {
      if (this.offset >= stopOffset) {
        this.systemAddress[i] = dummy;
      } else {
        this.systemAddress[i] = this.readAddress();
      }
    }
        
    this.sendPingTime = this.readLong();
    this.sendPongTime = this.readLong();
  }
}

module.exports = NewIncomingConnection;