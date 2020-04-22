# Changelog

## 1.1.2 (23/04/2020)

### Features
 * Inventory mocks now have `MinterRole` and minting functions are `onlyMinter` instead of `onlyOwner`.

## 1.1.1 (15/04/2020)

### Breaking changes
 * Moved `inventoryIds` to `@animoca/blockchain-inventory_metadata`.
 * inventoryIds is not exported any more at module level.

## 1.1.0 (14/04/2020)

### Breaking changes
 * Moved `ERC20Fees` and `WhitelistedOperators` to `@animoca/ethereum-contracts-erc20_base`.
 * Removed `ERC20FeesAssetsInventoryMock`, `ERC20FeesPausableInventoryMock` and the ERC20Fees-related tests.
 * `AssetsInventory` is now burnable by default.
 * Moved `UInt2Str` to `@animoca/ethereum-contracts-core_library`.
 * `inventoryIds.js` reworked and previous functions `idInfo`, `nftId` and `makeCollectionId` are DEPRECATED. 
 * Moved `inventoryIds.js` to `src/helpers/`.
 * Moved `constants.js` to `src/`.

### Features
 * Added `NonBurnableInventory`, `NonBurnablePausableInventory` and their respective Mocks.
 * New `inventoryIds` functions:
   * `isFungible(id)`
   * `Fungible.maxBaseCollectionId()`
   * `Fungible.makeCollectionId(baseCollectionId)`
   * `Fungible.getCollectionId(id)`,
   * `NonFungible.maxBaseCollectionId(nfMaskLength)`
   * `NonFungible.makeCollectionId(baseCollectionId, nfMaskLength)`
   * `NonFungible.getBaseCollectionId(id, nfMaskLength)`
   * `NonFungible.getCollectionId(id, nfMaskLength)`
   * `NonFungible.maxBaseTokenId(nfMaskLength)`
   * `NonFungible.makeTokenId(baseTokenId, baseCollectionId, nfMaskLength)`
   * `NonFungible.getBaseTokenId`
   * All these functions (except `isFungible`) return a string representation of the number value. Output base can be controlled by an optional last parameter which defaults to 10 (decimal representation).
 * Export `inventoryIds` and `constants` objects at module level.
 * Export `interfaces` object at module level: ERC165 interfaces for ERC721 and ERC1155.

### Improvement
 * Upgraded dependency on `@animoca/ethereum-contracts-core_library` from `0.0.1` to `0.0.2` and deeper integration.
 * Added unit tests for `inventoryIds`

 ## 1.0.1

### Bugfixes
* Fixed a bug where `ERC1155ReceiverMock` didn't return the correct value on batch transfers.

### Improvements
* Added dependency on `@animoca/ethereum-contracts-core_library`.

 ## 1.0.0
* Initial commit.