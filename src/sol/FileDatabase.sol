pragma solidity ^0.4.17;

contract FileDatabase {

    struct HashStore {
        address sender;

        string content;

        uint timestamp;
    }

    uint public lastHashId;
    mapping(uint => HashStore) public hashes;

    function FileDatabase() public {
        lastHashId = 0;
    }

    function write(string _hashContent) public {
        uint hashId = ++lastHashId;

        hashes[hashId].sender = msg.sender;
        hashes[hashId].content = _hashContent;
        hashes[hashId].timestamp = block.timestamp;
    }

    function read(uint _hashId) public view returns (address hashSender, string hashContent, uint timestamp) {
        return (hashes);
    }
}