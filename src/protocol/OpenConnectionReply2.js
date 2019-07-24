"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class OpenConnectionReply2 extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_OPEN_CONNECTION_REPLY_2;
    
    this.serverID;
    this.clientAddress;
    this.serverSecurity = false;
    this.mtuSize;
  }
  
  encodePayload() {
    this.writeMagic();
    this.writeLong(this.serverID);
    this.writeAddress(this.clientAddress);
    this.writeShort(this.mtuSize);
    this.writeByte(this.serverSecurity ? 1 : 0);
  }
  
  decodePayload() {
    this.readMagic();
    this.serverID = this.readLong();
    this.clientAddress = this.readAddress();
    this.mtuSize = this.readShort();
    this.serverSecurity = this.readByte() !== 0;
  }
}

module.exports = OpenConnectionReply2;