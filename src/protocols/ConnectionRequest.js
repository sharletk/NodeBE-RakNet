"use strict"

const Packet = require("./Packet.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class ConnectionRequest extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_CONNECTION_REQUEST;
    
    this.clientID;    
    this.sendPingTime;
    this.useSecurity = false;
  }
  
  encodePayload() {
    this.writeLong(this.clientID);
    this.writeLong(this.sendPingTime);
    this.writeByte(this.useSecurity ? 1 : 0);
  }
  
  decodePayload() {
    this.clientID = this.readLong();
    this.sendPingTime = this.readLong();
    this.useSecurity = this.readByte() !== 0;
  }
}

module.exports = ConnectionRequest;