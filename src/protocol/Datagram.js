"use strict"

const Packet = require("./Packet.js");

const EncapsulatedPacket = require("./EncapsulatedPacket.js");

class Datagram extends EncapsulatedPacket {
  constructor() {
    super();
    
    this.BITFLAG_VALID = 0x80;
    this.BITFLAG_ACK = 0x40;
    this.BITFLAG_NAK = 0x20;
    this.BITFLAG_PACKET_PAIR = 0x10;
    this.BITFLAG_CONTINUOUS_SEND = 0x08;
    this.BITFLAG_NEEDS_B_AND_AS = 0x04;
    
    this.headerFlags = 0;
    this.packets = [];
    this.seqNumber;
  }
  
  clean() {
    this.packets = [];
    this.seqNumber = null;
    
    super.clean;
  }
  
  __length() {
    let length = 4;
    for(packet in this.packets) {
      console.log(length);
      length += packet instanceof EncapsulatedPacket ? packet.getTotalLength() : packet.length;
    }
  }
  
  encodeHeader() {
    this.stream.writeByte(this.BITFLAG_VALID | this.headerFlags);
  }
  
  encodePayload() {
    this.stream.writeLTriad(this.seqNumber, 0);
    for(packet in this.packets) {
      this.writeData(packet instanceof EncapsulatedPacket ? packet.toBinary() : packet);
    }
  }
  
  decodeHeader() {
    this.headerFlags = this.stream.readByte();
  }
  
  decodePayload() {
    this.seqNumber = this.stream.readLTriad(0);
    
    while(!this.stream.feof()) {
      this.packets = EncapsulatedPacket.fromBinary(this);
    }
  }
}

module.exports = Datagram;