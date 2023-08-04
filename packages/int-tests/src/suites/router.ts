import assert = require('assert');
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { ZERO_ADDRESS } from '../utils/const';
import { Dex } from '../utils/chain-ops';

export async function routerSwaps(sut: SystemUnderTest) {
  logger.info(`Starting shortIncome test suite`);
  const { treasury, usdc, weth, swapRouter } = sut;

  let currentWethBalance = await weth.balanceOf(treasury.address);
  let currentUsdcBalance = await usdc.balanceOf(treasury.address);

  const wethAmount = parseUnits('0.01', 18);
  const usdcAmount = parseUnits('10', 6);

  for (const dexInfo of Object.entries(Dex)) {
    const dexPoolAddress =
      dexInfo[0] == 'Balancer'
        ? await swapRouter.balancerVault()
        : await swapRouter.dexPoolMapping(dexInfo[1], weth.address, usdc.address);
    if (dexPoolAddress == ZERO_ADDRESS) continue;
    logger.info(`Testing ${dexInfo[0]} dex`);

    const dex = defaultAbiCoder.encode(['uint'], [dexInfo[1]]);

    {
      logger.info(`  Testing swapExactOutput`);
      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      await (
        await swapRouter.swapExactOutput(dex, weth.address, usdc.address, wethAmount, usdcAmount, {
          gasLimit: 1_000_000,
        })
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`    Checking weth balances`);
      const poolWethDelta = currentPoolWethBalance.sub(oldPoolWethBalance);
      const wethDelta = oldWethBalance.sub(currentWethBalance);
      assert(wethDelta.eq(poolWethDelta));
      assert(!wethDelta.eq(0));
      assert(wethDelta.lte(wethAmount));

      logger.info(`    Checking usdc balances`);
      const poolUsdcDelta = oldPoolUsdcBalance.sub(currentPoolUsdcBalance);
      const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
      assert(usdcDelta.eq(poolUsdcDelta));
      assert(usdcDelta.eq(usdcAmount));
    }

    {
      logger.info(`  Testing swapExactInput`);
      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      await (
        await swapRouter.swapExactInput(dex, weth.address, usdc.address, wethAmount, usdcAmount, {
          gasLimit: 1_000_000,
        })
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`    Checking weth balances`);
      const poolWethDelta = currentPoolWethBalance.sub(oldPoolWethBalance);
      const wethDelta = oldWethBalance.sub(currentWethBalance);
      assert(wethDelta.eq(poolWethDelta));
      assert(!wethDelta.eq(0));

      logger.info(`    Checking usdc balances`);
      const poolUsdcDelta = oldPoolUsdcBalance.sub(currentPoolUsdcBalance);
      const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
      assert(usdcDelta.eq(poolUsdcDelta));
      assert(usdcDelta.gte(usdcAmount));
    }
  }
}
