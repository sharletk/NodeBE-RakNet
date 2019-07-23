"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class OpenConnectionRequest2 extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_OPEN_CONNECTION_REQUEST_2;
        
    this.clientID;
    this.serverAddress;    
    this.mtuSize;
  }
  
  encodePayload() {
    this.writeMagic();
    //Address
    this.writeShort(this.mtuSize);
    this.writeLong(this.clientID);
  }
  
  decodePayload() {
    this.readMagic();
    //Address
    this.mtuSize = this.readShort();
    this.clientID = this.readLong();
  }
}

module.exports = OpenConnectionRequest2;