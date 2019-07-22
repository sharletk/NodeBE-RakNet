"use strict"

const BinaryStream = require("nodebe-binarystream");

class Packet extends BinaryStream {
  constructor() {
    super();
    
    this.version;
    this.address;
    this.port;
    
    this.sendTime;
  }
  
  static getID() {
    return -1;
  }
  
  clean() {
    this.buffer = null;
    this.offset = 0;
    this.sendTime = null;
  }
  
  readString() {
    return this.readData(this.readShort());
  }
  
  writeString(v) {
    this.writeShort(v.length);
    this.writeData(v);
  }
  
  encode() {
    this.reset();
    this.encodeHeader();
    this.encodePayload();
  }
  
  encodeHeader() {
    this.writeByte(Packet.getID);
  }
  
  encodePayload() {}
  
  decode() {
    this.offset = 0;
    this.decodeHeader();
    this.decodePayload();
  }
  
  decodeHeader() {
    this.readByte();
  }
  
  decodePayload() {}
}

module.exports = Packet;