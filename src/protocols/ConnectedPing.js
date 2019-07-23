"use strict"

const Packet = require("./Packet.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class ConnectedPing extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_CONNECTED_PING;
    
    this.sendTime;
  }
  
  encodePayload() {
    this.writeLong(this.sendTime);
  }
  
  decodePayload() {
    this.sendTime = this.readLong();
  }
}

module.exports = ConnectedPing;