"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class UnconnectedPing extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_UNCONNECTED_PING;
    
    this.sendPingTime;
    this.clientId;
  }
  
  encodePayload() {
    this.writeLong(this.sendPingTime);
    this.writeMagic();
    this.writeLong(this.clientId);
  }
  
  decodePayload() {
    this.sendPingTime = this.readLong();
    this.readMagic();
    this.clientId = this.readLong();
  }
}

module.exports = UnconnectedPing;