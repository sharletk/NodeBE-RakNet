"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class UnconnectedPong extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_UNCONNECTED_PONG;
    
    this.sendPingTime;
    
    this.serverName;
    this.serverId;
  }
  
  encodePayload() {
    this.writeLong(this.sendPingTime);
    this.writeLong(this.serverId);    
    this.writeMagic();    
    this.writeString(this.serverName);
  }
  
  decodePayload() {
    this.sendPingTime = this.readLong();
    this.serverId = this.readLong();
    this.readMagic();
    this.serverName = this.readString().toString("utf8");
  }
}

module.exports = UnconnectedPong;