"use strict"

const Packet = require("./Packet.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class AdvertiseSystem extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_ADVERTISE_SYSTEM;
    
    this.serverName;
  }
  
  encodePayload() {
    this.writeString(this.serverName);
  }
  
  decodePayload() {
    this.serverName = this.readString();
  }
}

module.exports = AdvertiseSystem;