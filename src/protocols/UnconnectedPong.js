"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class UnconnectedPong extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_UNCONNECTED_PONG;
    
    this.sendPingTime;
    
    this.serverName;
    this.serverID;
  }
  
  encodePayload() {
    this.writeLong(this.sendPingTime);
    this.writeLong(this.serverID);    
    this.writeMagic();    
    this.writeString(this.serverName);
  }
  
  decodePayload() {
    this.sendPingTime = this.readLong();
    this.serverID = this.readLong();
    this.readMagic();
    this.serverName = this.readString().toString("utf8");
  }
}

module.exports = UnconnectedPong;