"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class OpenConnectionReply1 extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_OPEN_CONNECTION_REPLY_1;
    
    this.serverID;
    this.serverSecurity = false;
    this.mtuSize;
  }
  
  encodePayload() {
    this.writeMagic();
    this.writeLong(this.serverID);
    this.writeByte(this.serverSecurity ? 1 : 0);
    this.writeShort(this.mtuSize);
  }
  
  decodePayload() {
    this.readMagic();
    this.serverID = this.readLong();
    this.serverSecurity = this.readByte() !== 0;
    this.mtuSize = this.readShort();
  }
}

module.exports = OpenConnectionReply1;