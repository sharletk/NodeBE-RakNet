"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class IncompatibleProtocolVersion extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_INCOMPATIBLE_PROTOCOL_VERSION;
    
    this.protocolVersion;
    this.serverID;
  }
  
  encodePayload() {
    this.writeByte(this.protocolVersion);
    this.writeMagic();
    this.writeLong(this.serverID);
  }
    
  decodePayload() {
    this.protocolVersion = this.readByte();
    this.readMagic();
    this.serverID = this.readLong();
  }
}

module.exports = IncompatibleProtocolVersion;