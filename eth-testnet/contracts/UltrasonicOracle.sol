// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UltrasonicOracle {
    struct DataPacket {
        uint32 packetID;
        string deviceID;
        string payload;
        uint256 timestamp;
    }

    mapping(uint32 => DataPacket) public packets;
    event NewData(uint32 packetID, string deviceID, string payload);

    function submitPacket(
        uint32 packetID,
        string calldata deviceID,
        string calldata payload
    ) external {
        require(packets[packetID].packetID == 0, "Packet exists");
        packets[packetID] = DataPacket(packetID, deviceID, payload, block.timestamp);
        emit NewData(packetID, deviceID, payload);
    }
}
