"use strict"

const BinaryStream = require("nodebe-binarystream");

class Packet extends BinaryStream {
  constructor() {
    super();
    
    this.version;
    this.addr;
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
  
  readAddress() {
    this.version = this.readByte();
    switch(this.version) {
      case 4:
      this.addr = ((~this.readByte() & 0xff)) + "." + ((~this.readByte() & 0xff)) + "." + ((~this.readByte() & 0xff)) + "." + ((~this.readByte() & 0xff));
      
      this.port = this.readShort();      
      return this;
      
      break;
      
      case 6:
      this.readLShort();
      this.port = this.readShort();
      this.readInt();
      this.addr = this.readData(16);
      this.readInt();
      return this;
      
      break;
      
      default:
      return `Error: Unknown IP Address of version ${this.version}`;
    }
  }
  
  writeAddress(address = {}) {
    this.writeByte(address.version);
    switch(address.version) {
      case 4:
      let parts = address.ip.split(".", 4);
      if(parts.length !== 4) return `Error: Wrong number of parts in IPv4 IP, expected 4, got ${parts.length}`;
      let b;
      for(b in parts) {
        this.writeByte((Number(b)) & 0xff);
      }
      this.writeShort(address.port);
      return this;
      
      break;
      
      case 6:
      this.writeLShort()//
      this.writeShort(address.port);
      this.writeInt(0);
      this.writeData()//
      this.writeInt(0);
      return this;
      
      break;
      
      default:
      return `Error: IP version ${address.version} is not supported.`;
    }
  }
}

module.exports = Packet;