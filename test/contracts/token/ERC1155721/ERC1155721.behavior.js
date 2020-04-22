const { contract } = require('@openzeppelin/test-environment');
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const { shouldSupportInterfaces, constants } = require('@animoca/ethereum-contracts-core_library');
const { ZeroAddress } = constants;
const interfaces = require('../../../../src/interfaces/ERC165/ERC721');

const { ERC721Received_MagicValue } = require('../../../../src/constants');
const { makeFungibleCollectionId, makeNonFungibleTokenId } = require('@animoca/blockchain-inventory_metadata').inventoryIds;

const ERC721ReceiverMock = contract.fromArtifact('ERC721ReceiverMock');

function shouldBehaveLikeERC1155721(
  nfMaskLength,
  creator,
  [owner, approved, operator, other]
) {

  const fCollection1 = {
    id: makeFungibleCollectionId(1),
    supply: 10
  };
  const fCollection2 = {
    id: makeFungibleCollectionId(2),
    supply: 11
  };
  const fCollection3 = {
    id: makeFungibleCollectionId(2),
    supply: 12
  };

  const nft1 = makeNonFungibleTokenId(1, 1, nfMaskLength);
  const nft2 = makeNonFungibleTokenId(1, 2, nfMaskLength);
  const nft3 = makeNonFungibleTokenId(2, 2, nfMaskLength);

  describe('like an ERC1155721', function () {
    beforeEach(async function () {
      await this.token.mintFungible(owner, fCollection1.id, fCollection1.supply, { from: creator });
      await this.token.mintFungible(owner, fCollection2.id, fCollection2.supply, { from: creator });
      await this.token.mintFungible(owner, fCollection3.id, fCollection3.supply, { from: creator });
      await this.token.mintNonFungible(owner, nft1, { from: creator });
      await this.token.mintNonFungible(owner, nft2, { from: creator });
      await this.token.mintNonFungible(owner, nft3, { from: creator });

      this.toWhom = other; // default to anyone for toWhom in context-dependent tests
    });

    const data = '0x42';

    describe('721 events during 1155 functions', function () {
      describe('safeTransferFrom', function () {
        it('does not emit a Transfer event for a fungible transfer', async function () {
          const receipt = await this.token.methods['safeTransferFrom(address,address,uint256,uint256,bytes)'](owner, other, fCollection1.id, new BN(1), data, { from: owner });

          let present = false;
          try {
            expectEvent(receipt, 'Transfer', {
              _from: owner,
              _to: other
            });
            present = true;
          } catch (e) { }

          present.should.be.false;
        });

        it('emits a Transfer event for a non-fungible transfer', async function () {
          const receipt = await this.token.methods['safeTransferFrom(address,address,uint256,uint256,bytes)'](owner, other, nft1, new BN(1), data, { from: owner });
          expectEvent(receipt, 'Transfer', {
            _from: owner,
            _to: other,
            _tokenId: nft1
          });
        });
      });

      describe('safeBatchTransferFrom', function () {
        it('emits Transfer events for non fungible transfers', async function () {
          const ids = [nft1, fCollection1.id, nft2];
          const values = [new BN(1), new BN(1), new BN(1)];
          const receipt = await this.token.methods['safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)'](owner, other, ids, values, data, { from: owner });

          expectEvent(receipt, 'Transfer', {
            _from: owner,
            _to: other,
            _tokenId: nft1
          });

          expectEvent(receipt, 'Transfer', {
            _from: owner,
            _to: other,
            _tokenId: nft2
          });
        });
      });
    });

    describe('not response to ERC721 compatible functions', function () {
      beforeEach(async function () {
        await this.token.mintFungible(owner, fCollection1.id, fCollection1.supply, { from: creator });
        await this.token.mintFungible(owner, fCollection2.id, fCollection2.supply, { from: creator });
        this.toWhom = other; // default to anyone for toWhom in context-dependent tests
      });

      describe('balanceOf', function () {
        context('when the given address owns some fungible tokens', function () {
          it('returns 3', async function () {
            (await this.token.balanceOf(owner)).should.be.bignumber.equal('3');
          });
        });

        context('when the given address does not own any tokens', function () {
          it('returns 0', async function () {
            (await this.token.balanceOf(other)).should.be.bignumber.equal('0');
          });
        });

        context('when querying the zero address', function () {
          it('throws', async function () {
            await expectRevert.unspecified(this.token.balanceOf(ZeroAddress));
          });
        });
      });

      describe('ownerOf', function () {
        context('when the given collection ID was tracked by this token', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(this.token.ownerOf(fCollection1.id));
          });
        });

        context('when the given token ID was not tracked by this token', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(this.token.ownerOf(fCollection3.id));
          });
        });
      });

      describe('transfers', function () {
        const data = '0x42';

        beforeEach(async function () {
          await this.token.setApprovalForAll(operator, true, { from: owner });
        });

        const shouldNotTransferTokensByUsers = function (transferFunction, collectionId) {
          context('when called by the owner', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(transferFunction.call(this, owner, this.toWhom, collectionId, { from: owner }));
            });
          });

          context('when called by the operator', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(transferFunction.call(this, owner, this.toWhom, collectionId, { from: operator }));
            });
          });

          context('when sent to the owner', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(transferFunction.call(this, owner, owner, collectionId, { from: owner }));
            });
          });

          context('when the address of the previous owner is incorrect', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(transferFunction.call(this, owner, other, collectionId, { from: owner })
              );
            });
          });

          context('when the sender is not authorized for the token id', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(transferFunction.call(this, owner, other, collectionId, { from: other })
              );
            });
          });

          context('when the given token ID does not exist', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(transferFunction.call(this, owner, other, fCollection3.id, { from: owner })
              );
            });
          });

          context('when the address to transfer the token to is the zero address', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(
                transferFunction.call(this, owner, ZeroAddress, collectionId, { from: owner })
              );
            });
          });
        };

        describe('via transferFrom', function () {
          shouldNotTransferTokensByUsers(function (from, to, tokenId, opts) {
            return this.token.transferFrom(from, to, tokenId, opts);
          }, fCollection1.id);
        });

        describe('via safeTransferFrom', function () {
          const safeTransferFromWithData = function (from, to, tokenId, opts) {
            return this.token.methods['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data, opts);
          };

          const safeTransferFromWithoutData = function (from, to, tokenId, opts) {
            return this.token.methods['safeTransferFrom(address,address,uint256)'](from, to, tokenId, opts);
          };

          const shouldNotTransferSafely = function (transferFun, data) {
            describe('to a user account', function () {
              shouldNotTransferTokensByUsers(transferFun, fCollection1.id);
            });

            describe('to a valid receiver contract', function () {
              beforeEach(async function () {
                this.receiver = await ERC721ReceiverMock.new(ERC721Received_MagicValue, false);
                this.toWhom = this.receiver.address;
              });

              shouldNotTransferTokensByUsers(transferFun, fCollection1.id);

              describe('with an invalid token id', function () {
                it('reverts', async function () {
                  await expectRevert.unspecified(
                    transferFun.call(
                      this,
                      owner,
                      this.receiver.address,
                      fCollection3.id,
                      { from: owner },
                    )
                  );
                });
              });
            });
          };

          describe('with data', function () {
            shouldNotTransferSafely(safeTransferFromWithData, data);
          });

          describe('without data', function () {
            shouldNotTransferSafely(safeTransferFromWithoutData, null);
          });

          describe('to a receiver contract returning unexpected value', function () {
            it('reverts', async function () {
              const invalidReceiver = await ERC721ReceiverMock.new('0x42', false);
              await expectRevert.unspecified(
                this.token.contract.methods.safeTransferFrom(owner, invalidReceiver.address, fCollection1.id.toString(10)).send({ from: owner, gas: 4000000 })
              );
            });
          });

          describe('to a receiver contract that throws', function () {
            it('reverts', async function () {
              const invalidReceiver = await ERC721ReceiverMock.new(ERC721Received_MagicValue, true);
              await expectRevert.unspecified(
                this.token.contract.methods.safeTransferFrom(owner, invalidReceiver.address, fCollection1.id.toString(10)).send({ from: owner, gas: 4000000 })
              );
            });
          });

          describe('to a contract that does not implement the required function', function () {
            it('reverts', async function () {
              const invalidReceiver = this.token;
              await expectRevert.unspecified(
                this.token.contract.methods.safeTransferFrom(owner, invalidReceiver.address, fCollection1.id.toString(10)).send({ from: owner, gas: 4000000 })
              );
            });
          });
        });
      });

      describe('approve', function () {
        const tokenId = fCollection1.id;

        context('when approving a non-zero address', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(this.token.approve(approved, tokenId, { from: owner }));
          });
        });

        context('when the address that receives the approval is the owner', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              this.token.approve(owner, tokenId, { from: owner })
            );
          });
        });

        context('when the sender does not own the given token ID', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(this.token.approve(approved, tokenId, { from: other }));
          });
        });

        context('when the sender is an operator', function () {
          it('reverts', async function () {
            await this.token.setApprovalForAll(operator, true, { from: owner });
            await expectRevert.unspecified(this.token.approve(approved, tokenId, { from: operator }));
          });
        });

        context('when the given token ID does not exist', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(this.token.approve(approved, fCollection3.id, { from: owner }));
          });
        });
      });
    });

    // TODO add receiver checks

    shouldSupportInterfaces([
      interfaces.ERC721Exists_Experimental,
    ]);
  });
}

module.exports = {
  shouldBehaveLikeERC1155721,
};