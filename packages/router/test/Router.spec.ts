import { expect } from 'chai';
import { createMarginlyRouter } from './shared/fixtures';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

describe('MarginlyRouter UniswapV3', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(0, token0.address, token1.address, amountToSwap, 0);

    expect(await uniswapV3Pool.debugZeroForOne()).to.be.true;
    expect(await uniswapV3Pool.debugExactInput()).to.be.true;

    const price = await uniswapV3Pool.price();

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(price.mul(amountToSwap));
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await uniswapV3Pool.price();
    const amountToGetPlusOne = price.mul(amountToSwap).add(1);

    expect(
      marginlyRouter.connect(user).swapExactInput(0, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('Insufficient amount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(0, token1.address, token0.address, amountToSwap, 0);
    expect(await uniswapV3Pool.debugZeroForOne()).to.be.false;
    expect(await uniswapV3Pool.debugExactInput()).to.be.true;
    const price = await uniswapV3Pool.price();

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    expect(await token0.balanceOf(user.address)).to.be.equal(BigNumber.from(amountToSwap).div(price));
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await uniswapV3Pool.price();
    const amountToGetPlusOne = BigNumber.from(amountToSwap).div(price).add(1);

    expect(
      marginlyRouter.connect(user).swapExactInput(0, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('Insufficient amount');
  });

  it('swapExactOutput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3Pool.price();

    const amountToGet = 1000;
    const amountTransferred = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(0, token0.address, token1.address, initialAmount0, amountToGet);

    expect(await uniswapV3Pool.debugZeroForOne()).to.be.true;
    expect(await uniswapV3Pool.debugExactInput()).to.be.false;

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 0 to 1, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3Pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountToSwap.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(
      marginlyRouter.connect(user).swapExactOutput(0, token0.address, token1.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWith('Too much requested');
  });

  it('swapExactOutput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3Pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(0, token1.address, token0.address, initialAmount1, amountToGet);

    expect(await uniswapV3Pool.debugZeroForOne()).to.be.false;
    expect(await uniswapV3Pool.debugExactInput()).to.be.false;

    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1.sub(amountToSwap));
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3Pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);

    expect(
      marginlyRouter.connect(user).swapExactOutput(0, token1.address, token0.address, amountToSwap.add(1), amountToGet)
    ).to.be.revertedWith('Too much requested');
  });
});

describe('MarginlyRouter UniswapV2', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(1, token0.address, token1.address, amountToSwap, 0);

    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve1.mul(amountToSwapWithFee).div(reserve0.mul(1000).add(amountToSwapWithFee));

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve1.mul(amountToSwapWithFee).div(reserve0.mul(1000).add(amountToSwapWithFee));

    expect(
      marginlyRouter.connect(user).swapExactInput(1, token0.address, token1.address, amountToSwap, amountToGet.add(1))
    ).to.be.revertedWith('Insufficient amount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(1, token1.address, token0.address, amountToSwap, 0);
    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve0.mul(amountToSwapWithFee).div(reserve1.mul(1000).add(amountToSwapWithFee));

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve0.mul(amountToSwapWithFee).div(reserve1.mul(1000).add(amountToSwapWithFee));

    expect(
      marginlyRouter.connect(user).swapExactInput(1, token1.address, token0.address, amountToSwap, amountToGet.add(1))
    ).to.be.revertedWith('Insufficient amount');
  });

  it('swapExactOutput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const amountToGet = 1000;
    const amountTransferred = reserve0.mul(amountToGet).mul(1000).div(reserve1.sub(amountToGet).mul(997)).add(1);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(1, token0.address, token1.address, initialAmount0, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 0 to 1, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3Pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountToSwap.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(
      marginlyRouter.connect(user).swapExactOutput(1, token0.address, token1.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWith('Too much requested');
  });

  it('swapExactOutput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const amountToGet = 1000;
    const amountToSwap = reserve1.mul(amountToGet).mul(1000).div(reserve0.sub(amountToGet).mul(997)).add(1);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(1, token1.address, token0.address, initialAmount1, amountToGet);

    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1.sub(amountToSwap));
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2Pair } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = 1;

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);

    expect(
      marginlyRouter.connect(user).swapExactOutput(1, token1.address, token0.address, amountToSwap.add(1), amountToGet)
    ).to.be.revertedWith('Too much requested');
  });
});

describe('MarginlyRouter Balancer Vault', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(2, token0.address, token1.address, amountToSwap, 0);

    const price = await balancerVault.price();

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(price.mul(amountToSwap));
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await balancerVault.price();
    const amountToGetPlusOne = price.mul(amountToSwap).add(1);

    expect(
      marginlyRouter.connect(user).swapExactInput(2, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('Insufficient amount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(2, token1.address, token0.address, amountToSwap, 0);
    const price = await balancerVault.price();

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    expect(await token0.balanceOf(user.address)).to.be.equal(BigNumber.from(amountToSwap).div(price));
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await balancerVault.price();
    const amountToGetPlusOne = BigNumber.from(amountToSwap).div(price).add(1);

    expect(
      marginlyRouter.connect(user).swapExactInput(2, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('Insufficient amount');
  });

  it('swapExactOutput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await balancerVault.price();

    const amountToGet = 1000;
    const amountTransferred = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(2, token0.address, token1.address, initialAmount0, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 0 to 1, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await balancerVault.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountToSwap.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(
      marginlyRouter.connect(user).swapExactOutput(2, token0.address, token1.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWith('Too much requested');
  });

  it('swapExactOutput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await balancerVault.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(2, token1.address, token0.address, initialAmount1, amountToGet);

    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1.sub(amountToSwap));
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, balancerVault } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await balancerVault.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);

    expect(
      marginlyRouter.connect(user).swapExactOutput(2, token1.address, token0.address, amountToSwap.add(1), amountToGet)
    ).to.be.revertedWith('Too much requested');
  });
});

describe('MarginlyRouter UnknownDex', () => {
  it('swapExactInput UnknownDex', async () => {
    const { marginlyRouter, token0, token1 } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 10;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    expect(
      marginlyRouter.connect(user).swapExactInput(255, token0.address, token1.address, amountToSwap, 0)
    ).to.be.revertedWithCustomError(marginlyRouter, 'UnknownDex');
  });

  it('swapExactOutput UnknownDex', async () => {
    const { marginlyRouter, token0, token1, uniswapV3Pool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3Pool.price();
    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    expect(
      marginlyRouter.connect(user).swapExactOutput(0, token1.address, token0.address, amountToSwap, amountToGet)
    ).to.be.revertedWithCustomError(marginlyRouter, 'UnknownDex');
  });
});
