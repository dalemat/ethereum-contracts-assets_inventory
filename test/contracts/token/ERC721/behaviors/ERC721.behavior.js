const { contract } = require('@openzeppelin/test-environment');
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const { behaviors, constants, interfaces } = require('@animoca/ethereum-contracts-core_library');
const { ZeroAddress, } = constants;
const interfaces721 = require('../../../../../src/interfaces/ERC165/ERC721');

// const { ERC721Received_MagicValue } = require('../../../../../src/constants');
const { makeNonFungibleTokenId } = require('@animoca/blockchain-inventory_metadata').inventoryIds;

const ERC721ReceiverMock = contract.fromArtifact('ERC721ReceiverMock');

function shouldBehaveLikeERC721(
  nfMaskLength,
  creator, [owner, approved, anotherApproved, operator, other]
) {
  const nft1 = makeNonFungibleTokenId(1, 1, nfMaskLength);
  const nft2 = makeNonFungibleTokenId(2, 1, nfMaskLength);
  const unknownNFT = makeNonFungibleTokenId(999, 1, nfMaskLength);

  describe('like an ERC721', function () {
    beforeEach(async function () {
      await this.token.mintNonFungible(owner, nft1, { from: creator });
      await this.token.mintNonFungible(owner, nft2, { from: creator });
      this.toWhom = other; // default to anyone for toWhom in context-dependent tests
    });

    describe('balanceOf', function () {
      context('when the given address owns some tokens', function () {
        it('returns the amount of tokens owned by the given address', async function () {
          (await this.token.balanceOf(owner)).should.be.bignumber.equal('2');
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
      context('when the given token ID was tracked by this token', function () {
        const tokenId = nft1;

        it('returns the owner of the given token ID', async function () {
          (await this.token.ownerOf(tokenId)).should.be.equal(owner);
        });
      });

      context('when the given token ID was not tracked by this token', function () {
        const tokenId = unknownNFT;

        it('reverts', async function () {
          await expectRevert.unspecified(this.token.ownerOf(tokenId));
        });
      });
    });

    // describe('totalSupply', function () {
    //   it('returns total token supply', async function () {
    //     (await this.token.totalSupply()).should.be.bignumber.equal('2');
    //   });
    // });

    describe('transfers', function () {
      const tokenId = nft1;
      const data = '0x42';

      let receipt = null;

      beforeEach(async function () {
        await this.token.approve(approved, tokenId, { from: owner });
        await this.token.setApprovalForAll(operator, true, { from: owner });
      });

      const transferWasSuccessful = function ({ owner, tokenId, approved }) {
        it('transfers the ownership of the given token ID to the given address', async function () {
          (await this.token.ownerOf(tokenId)).should.be.equal(this.toWhom);
        });

        it('clears the approval for the token ID', async function () {
          (await this.token.getApproved(tokenId)).should.be.equal(ZeroAddress);
        });

        if (approved) {
          it('emits a transfer event', function () {
            expectEvent(receipt, 'Transfer', {
              _from: owner,
              _to: this.toWhom,
              _tokenId: tokenId,
            });
          });
        } else {
          it('emits only a transfer event', function () {
            expectEvent(receipt, 'Transfer', {
              _from: owner,
              _to: this.toWhom,
              _tokenId: tokenId,
            });
          });
        }

        it('adjusts owners balances', async function () {
          (await this.token.balanceOf(owner)).should.be.bignumber.equal('1');
        });

        it('adjusts recipient balances', async function () {
          (await this.token.balanceOf(this.toWhom)).should.be.bignumber.equal('1');
        });

        it('adjusts owners tokens by index', async function () {
          if (!this.token.tokenOfOwnerByIndex) return;

          (await this.token.tokenOfOwnerByIndex(this.toWhom, 0)).should.be.bignumber.equal(tokenId);

          (await this.token.tokenOfOwnerByIndex(owner, 0)).should.be.bignumber.not.equal(tokenId);
        });
      };

      const shouldTransferTokensByUsers = function (transferFunction) {
        context('when called by the owner', function () {
          beforeEach(async function () {
            receipt = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: owner });
          });
          transferWasSuccessful({ owner, tokenId, approved });
        });

        context('when called by the approved individual', function () {
          beforeEach(async function () {
            receipt = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: approved });
          });
          transferWasSuccessful({ owner, tokenId, approved });
        });

        context('when called by the operator', function () {
          beforeEach(async function () {
            receipt = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: operator });
          });
          transferWasSuccessful({ owner, tokenId, approved });
        });

        context('when called by the owner without an approved user', function () {
          beforeEach(async function () {
            await this.token.approve(ZeroAddress, tokenId, { from: owner });
            receipt = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: operator });
          });
          transferWasSuccessful({ owner, tokenId, approved: null });
        });

        context('when sent to the owner', function () {
          beforeEach(async function () {
            receipt = await transferFunction.call(this, owner, owner, tokenId, { from: owner });
          });

          it('keeps ownership of the token', async function () {
            (await this.token.ownerOf(tokenId)).should.be.equal(owner);
          });

          it('clears the approval for the token ID', async function () {
            (await this.token.getApproved(tokenId)).should.be.equal(ZeroAddress);
          });

          it('emits only a transfer event', function () {
            expectEvent(receipt, 'Transfer', {
              _from: owner,
              _to: owner,
              _tokenId: tokenId,
            });
          });

          it('keeps the owner balance', async function () {
            (await this.token.balanceOf(owner)).should.be.bignumber.equal('2');
          });

          it('keeps same tokens by index', async function () {
            if (!this.token.tokenOfOwnerByIndex) return;
            const tokensListed = await Promise.all(
              [0, 1].map(i => this.token.tokenOfOwnerByIndex(owner, i))
            );
            tokensListed.map(t => t.toNumber()).should.have.members(
              [nft1.toNumber(), nft1.toNumber()]
            );
          });
        });

        context('when the address of the previous owner is incorrect', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(transferFunction.call(this, other, other, tokenId, { from: owner })
            );
          });
        });

        context('when the sender is not authorized for the token id', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(transferFunction.call(this, owner, other, tokenId, { from: other })
            );
          });
        });

        context('when the given token ID does not exist', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(transferFunction.call(this, owner, other, unknownNFT, { from: owner })
            );
          });
        });

        context('when the address to transfer the token to is the zero address', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              transferFunction.call(this, owner, ZeroAddress, tokenId, { from: owner })
            );
          });
        });
      };

      describe('via transferFrom', function () {
        shouldTransferTokensByUsers(function (from, to, tokenId, opts) {
          return this.token.transferFrom(from, to, tokenId, opts);
        });
      });

      describe('via safeTransferFrom', function () {
        const safeTransferFromWithData = function (from, to, tokenId, opts) {
          return this.token.methods['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data, opts);
        };

        const safeTransferFromWithoutData = function (from, to, tokenId, opts) {
          return this.token.methods['safeTransferFrom(address,address,uint256)'](from, to, tokenId, opts);
        };

        const shouldTransferSafely = function (transferFun, data) {
          describe('to a user account', function () {
            shouldTransferTokensByUsers(transferFun);
          });

          describe('to a valid receiver contract', function () {
            beforeEach(async function () {
              this.receiver = await ERC721ReceiverMock.new(true);
              this.toWhom = this.receiver.address;
            });

            shouldTransferTokensByUsers(transferFun);

            it('should call onERC721Received', async function () {
              receipt = await transferFun.call(this, owner, this.receiver.address, tokenId, { from: owner });

              await expectEvent.inTransaction(receipt.tx, ERC721ReceiverMock, 'Received', {
                operator: owner,
                from: owner,
                tokenId: tokenId,
                data: data,
              });
            });

            it('should call onERC721Received from approved', async function () {
              receipt = await transferFun.call(this, owner, this.receiver.address, tokenId, { from: approved });

              await expectEvent.inTransaction(receipt.tx, ERC721ReceiverMock, 'Received', {
                operator: approved,
                from: owner,
                tokenId: tokenId,
                data: data,
              });
            });

            describe('with an invalid token id', function () {
              it('reverts', async function () {
                await expectRevert.unspecified(
                  transferFun.call(
                    this,
                    owner,
                    this.receiver.address,
                    unknownNFT,
                    { from: owner },
                  )
                );
              });
            });
          });
        };

        describe('with data', function () {
          shouldTransferSafely(safeTransferFromWithData, data);
        });

        describe('without data', function () {
          shouldTransferSafely(safeTransferFromWithoutData, null);
        });

        describe('to a receiver contract returning unexpected value', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721ReceiverMock.new(false);
            await expectRevert.unspecified(
              this.token.methods['safeTransferFrom(address,address,uint256)'](owner, invalidReceiver.address, tokenId, { from: owner })
            );
          });
        });

        describe('to a contract that does not implement the required function', function () {
          it('reverts', async function () {
            const invalidReceiver = this.token;
            await expectRevert.unspecified(
              this.token.methods['safeTransferFrom(address,address,uint256)'](owner, invalidReceiver.address, tokenId, { from: owner })
            );
          });
        });
      });
    });

    describe('approve', function () {
      const tokenId = nft1;

      let receipt = null;

      const itClearsApproval = function () {
        it('clears approval for the token', async function () {
          (await this.token.getApproved(tokenId)).should.be.equal(ZeroAddress);
        });
      };

      const itApproves = function (address) {
        it('sets the approval for the target address', async function () {
          (await this.token.getApproved(tokenId)).should.be.equal(address);
        });
      };

      const itEmitsApprovalEvent = function (address) {
        it('emits an approval event', async function () {
          expectEvent(receipt, 'Approval', {
            _owner: owner,
            _approved: address,
            _tokenId: tokenId,
          });
        });
      };

      context('when clearing approval', function () {
        context('when there was no prior approval', function () {
          beforeEach(async function () {
            receipt = await this.token.approve(ZeroAddress, tokenId, { from: owner });
          });

          itClearsApproval();
          itEmitsApprovalEvent(ZeroAddress);
        });

        context('when there was a prior approval', function () {
          beforeEach(async function () {
            await this.token.approve(approved, tokenId, { from: owner });
            receipt = await this.token.approve(ZeroAddress, tokenId, { from: owner });
          });

          itClearsApproval();
          itEmitsApprovalEvent(ZeroAddress);
        });
      });

      context('when approving a non-zero address', function () {
        context('when there was no prior approval', function () {
          beforeEach(async function () {
            receipt = await this.token.approve(approved, tokenId, { from: owner });
          });

          itApproves(approved);
          itEmitsApprovalEvent(approved);
        });

        context('when there was a prior approval to the same address', function () {
          beforeEach(async function () {
            await this.token.approve(approved, tokenId, { from: owner });
            receipt = await this.token.approve(approved, tokenId, { from: owner });
          });

          itApproves(approved);
          itEmitsApprovalEvent(approved);
        });

        context('when there was a prior approval to a different address', function () {
          beforeEach(async function () {
            await this.token.approve(approved, tokenId, { from: owner });
            receipt = await this.token.approve(anotherApproved, tokenId, { from: owner });
          });

          itApproves(anotherApproved);
          itEmitsApprovalEvent(anotherApproved);
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

      context('when the sender is approved for the given token ID', function () {
        it('reverts', async function () {
          await this.token.approve(approved, tokenId, { from: owner });
          await expectRevert.unspecified(this.token.approve(anotherApproved, tokenId, { from: approved }));
        });
      });

      context('when the sender is an operator', function () {
        beforeEach(async function () {
          await this.token.setApprovalForAll(operator, true, { from: owner });
          receipt = await this.token.approve(approved, tokenId, { from: operator });
        });

        itApproves(approved);
        itEmitsApprovalEvent(approved);
      });

      context('when the given token ID does not exist', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(this.token.approve(approved, unknownNFT, { from: operator }));
        });
      });
    });

    describe('setApprovalForAll', function () {
      context('when the operator willing to approve is not the owner', function () {
        context('when there is no operator approval set by the sender', function () {
          it('approves the operator', async function () {
            await this.token.setApprovalForAll(operator, true, { from: owner });

            (await this.token.isApprovedForAll(owner, operator)).should.equal(true);
          });

          it('emits an approval event', async function () {
            const receipt = await this.token.setApprovalForAll(operator, true, { from: owner });

            expectEvent(receipt, 'ApprovalForAll', {
              _owner: owner,
              _operator: operator,
              _approved: true,
            });
          });
        });

        context('when the operator was set as not approved', function () {
          beforeEach(async function () {
            await this.token.setApprovalForAll(operator, false, { from: owner });
          });

          it('approves the operator', async function () {
            await this.token.setApprovalForAll(operator, true, { from: owner });

            (await this.token.isApprovedForAll(owner, operator)).should.equal(true);
          });

          it('emits an approval event', async function () {
            receipt = await this.token.setApprovalForAll(operator, true, { from: owner });

            expectEvent(receipt, 'ApprovalForAll', {
              _owner: owner,
              _operator: operator,
              _approved: true,
            });
          });

          it('can unset the operator approval', async function () {
            await this.token.setApprovalForAll(operator, false, { from: owner });

            (await this.token.isApprovedForAll(owner, operator)).should.equal(false);
          });
        });

        context('when the operator was already approved', function () {
          beforeEach(async function () {
            await this.token.setApprovalForAll(operator, true, { from: owner });
          });

          it('keeps the approval to the given address', async function () {
            await this.token.setApprovalForAll(operator, true, { from: owner });

            (await this.token.isApprovedForAll(owner, operator)).should.equal(true);
          });

          it('emits an approval event', async function () {
            const receipt = await this.token.setApprovalForAll(operator, true, { from: owner });

            expectEvent(receipt, 'ApprovalForAll', {
              _owner: owner,
              _operator: operator,
              _approved: true,
            });
          });
        });
      });

      context('when the operator is the owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(this.token.setApprovalForAll(owner, true, { from: owner }));
        });
      });
    });

    describe('ERC165 interfaces support', function () {
      behaviors.shouldSupportInterfaces([
        interfaces.ERC165,
        interfaces721.ERC721,
        interfaces721.ERC721Exists_Experimental,
      ]);
    });
  });
}

module.exports = {
  shouldBehaveLikeERC721,
};
