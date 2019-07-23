"use strict"

const BinaryStream = require("nodebe-binarystream");

const PacketReliability = require("./PacketReliability.js");

class EncapsulatedPacket {
  constructor() {
    this.RELIABILITY_SHIFT = 5;
    this.RELIABILITY_FLAGS = 0b111 << this.RELIABILITY_SHIFT;
    
    this.SPLIT_FLAG = 0b00010000;
    
    
    this.reliability;
    
    this.hasLength = false;
    this.length = 0;
    
    this.messageIndex;    
    this.sequenceIndex;
    
    this.orderIndex;
    this.orderChannel;
    
    this.splitCount;
    this.splitID;
    this.splitIndex;
    
    this.stream = new BinaryStream();
    
    this.packetreliability = new PacketReliability();
    
    this.indentifierAck;
  }
  
  __toString() {
    return this.toBinary();
  }
  
  getTotalLength() {
    return 3 + this.stream.length + (this.messageIndex !== null ? 3 : 0) + (this.orderIndex !== null ? 4 : 0) + (this.hasSplit ? 10 : 0);
  }
  
  fromInternalBinary(bytes) {
    let packet = new EncapsulatedPacket();
    
    let offset = 0;
    packet.reliability;
    
    packet.indentifierAck = this.stream.readInt(offset);
    offset += 4;
    
    if (this.packetreliability.isSequencedOrOrdered(packet.reliability)) {
      packet.orderChannel;
    }
    
    packet.stream;
    return packet;
  }
  
  toInternalBinary() {
    return
      this.reliability +
      this.stream.writeInt(this.indentifierAck ? -1 : null) +
      
      (this.packetreliability.isSequencedOrOrdered(this.reliability) ? this.orderChannel : "") +
      this.stream;
  }
  
  fromBinary(stream) {
    let packet = new BinaryStream();
    
    let flags = stream.readByte();
    
    let reliability;
    let hasSplit
    
    packet.reliability = reliability = (flags & this.RELIABILITY_FLAGS) >> this.RELIABILITY_SHIFT;
    packet.hasSplit = hasSplit = (flags & this.SPLIT_FLAG) > 0;
    
    let length = Math.ceil(stream.readShort / 8);
    if (length === 0) {
      return "Error: EncapsulatedPacket Payload length cannot be zero.";
    }
    
    if (reliability > this.packetreliability.UNRELIABLE) {
      if (this.packetreliability.isReliable(reliability)) {
        packet.messageIndex = stream.readLTriad();
      }
      
      if (this.packetreliability.isSequenced(reliability)) {
        packet.sequenceIndex = stream.readLTriad();
      }
      
      if (this.packetreliability.isSequencedOrOrdered(reliability)) {
        packet.orderIndex = stream.readLTriad();
        packet.orderChannel = stream.readByte();
      }
    }
    
    if(hasSplit) {
      packet.splitCount = stream.readInt();
      packet.splitID = stream.readShort();
      packet.splitIndex = stream.readInt();
    }
    
    let buf = new BinaryStream(stream.buffer.slice(this.stream.offset, stream.offset + packet.length));
    
    packet.stream = stream.writeData(buf)
    
    stream.offset += packet.length;
    
    return packet;
  }
  
  toBinary() {
    return
      ((this.reliability << this.RELIABILITY_SHIFT) | (this.hasSplit ? this.SPLIT_FLAG : 0)) +
      this.stream.writeShort(this.buffer.length << 3) +
      (this.reliability > this.packetreliability.UNRELIABLE ?
        (this.packetreliability.isReliable(this.reliability) ? this.stream.writeLTriad(this.messageIndex) : "") +
        (this.packetreliability.isSequenced(this.reliability) ? this.stream.writeLTriad(this.sequenceIndex) : "") +
        (this.packetreliability.isSequencedOrOrdered(this.reliability) ? this.stream.writeLTriad(this.orderIndex) + this.orderChannel : "")
        : ""
      ) +
      (this.hasSplit ? this.stream.writeInt(this.splitCount) +
       this.stream.writeShort(this.splitID) +
       this.stream.writeInt(this.splitIndex) : ""
      ) + this.buffer;
  }
}

module.exports = EncapsulatedPacket;