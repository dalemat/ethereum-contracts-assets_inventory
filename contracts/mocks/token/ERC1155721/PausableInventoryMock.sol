pragma solidity ^0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@animoca/ethereum-contracts-core_library/contracts/access/MinterRole.sol";
import "@animoca/ethereum-contracts-core_library/contracts/utils/RichUInt256.sol";
import "../../../token/ERC1155721/PausableInventory.sol";

contract PausableInventoryMock is PausableInventory, Ownable, MinterRole  {

    using RichUInt256 for uint256;

    string public override constant name = "PausableInventoryMock";
    string public override constant symbol = "PIM";

    constructor(uint256 nfMaskLength) public PausableInventory(nfMaskLength) {}

    /**
     * @dev This function creates the collection id.
     * @param collectionId collection identifier
     */
    function createCollection(uint256 collectionId) external onlyOwner {
        require(!isNFT(collectionId), "ERC1155: creating collection with incorrect collection id");
        emit URI(_uri(collectionId), collectionId);
    }

    function batchMint(
        address to,
        uint256[] calldata ids,
        uint256[] calldata values
    ) external onlyMinter {
        bytes memory data = "";
        bool safe = false;
        _batchMint(to, ids, values, data, safe);
    }

    function safeBatchMint(
        address to,
        uint256[] calldata ids,
        uint256[] calldata values
    ) external onlyMinter {
        bytes memory data = "";
        bool safe = true;
        _batchMint(to, ids, values, data, safe);
    }

    function mintNonFungible(address to, uint256 nftId) external onlyMinter {
        bytes memory data = "";
        bool batch = false;
        bool safe = false;
        _mintNonFungible(to, nftId, data, batch, safe);
    }

    function mintFungible(address to, uint256 collectionId, uint256 value) external onlyMinter {
        bytes memory data = "";
        bool batch = false;
        bool safe = false;
        _mintFungible(to, collectionId, value, data, batch, safe);
    }

    function burnFrom(
        address from,
        uint256 id,
        uint256 value
    ) external virtual whenNotPaused whenIdNotPaused(id)
    {
        _burnFrom(from, id, value);
    }

    function _uri(uint256 id) internal override view returns (string memory) {
        return string(abi.encodePacked("https://prefix/json/", id.toString()));
    }
}
