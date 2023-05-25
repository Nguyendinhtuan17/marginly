import assert = require('assert');
import { BigNumber, Wallet } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { SystemUnderTest } from ".";
import { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { CallType } from "../utils/chain-ops";
import { ZERO_ADDRESS } from "../utils/const";
import { FP96 } from '../utils/fixed-point';
import { logger } from '../utils/logger';

const paramsDefaultLeverage = {
  interestRate: 0,
  maxLeverage: 20n,
  swapFee: 1000, // 0.1%
  priceSecondsAgo: 900n, // 15 min
  positionSlippage: 20000, // 2%
  mcSlippage: 50000, //5%
  positionMinAmount: 10000000000000000n, // 0,01 ETH
  baseLimit: 10n ** 9n * 10n ** 18n,
  quoteLimit: 10n ** 12n * 10n ** 6n,
};

const paramsLowLeverage = {
  interestRate: 0,
  maxLeverage: 10n,
  swapFee: 1000, // 0.1%
  priceSecondsAgo: 900n, // 15 min
  positionSlippage: 20000, // 2%
  mcSlippage: 50000, //5%
  positionMinAmount: 10000000000000000n, // 0,01 ETH
  baseLimit: 10n ** 9n * 10n ** 18n,
  quoteLimit: 10n ** 12n * 10n ** 6n,
}

export async function deleveragePrecisionLong(sut: SystemUnderTest) {
  const { marginlyPool, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;

  // we set interest rate as 0 for this test so we don't need to calculate accrued rate
  // liquidations are approached via decreasing maxLeverage
  await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage);

  const lender = accounts[0];
  const liquidatedLong = accounts[1];
  const shortersNum = 4;
  const shorters = accounts.slice(2, 2 + shortersNum);
  // 20 WETH in total
  const shortersBaseDebt = [parseUnits('2', 18), parseUnits('3', 18), parseUnits('4', 18), parseUnits('11', 18)];

  const lenderBaseAmount = parseUnits('1', 18); // 1 WETH
  const lenderQuoteAmount = parseUnits('200000', 6); // 200000 USDC;

  await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
  await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

  await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
  await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

  let nextDate = Math.floor(Date.now() / 1000);
  const timeDelta = 24 * 60 * 60;

  for(let i = 0; i < 10; ++i) {
    logger.info(`iteration ${i + 1}`)
    const longerBaseDeposit = parseUnits('1', 18); // 1 WETH
    await (await weth.connect(treasury).transfer(liquidatedLong.address, longerBaseDeposit)).wait();
    await (await weth.connect(liquidatedLong).approve(marginlyPool.address, longerBaseDeposit)).wait();

    const longerLongAmount = parseUnits('18', 18); // 18 WETH
    await marginlyPool
      .connect(liquidatedLong)
      .execute(CallType.DepositBase, longerBaseDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

    console.log(`WETH Balance after depositBase ${formatUnits(await weth.balanceOf(marginlyPool.address), 18)}`);

    await marginlyPool
      .connect(liquidatedLong)
      .execute(CallType.Long, longerLongAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

    console.log(`WETH Balance after long ${formatUnits(await weth.balanceOf(marginlyPool.address), 18)}`);

    const shortersQuoteDeposit = parseUnits('20000', 6); // 20000 USDC

    for(let j = 0; j < shortersNum; ++j) {
      await (await usdc.connect(treasury).transfer(shorters[j].address, shortersQuoteDeposit)).wait();
      await (await usdc.connect(shorters[j]).approve(marginlyPool.address, shortersQuoteDeposit)).wait();
      logger.info(`DepositQuote`);
      await(
        await marginlyPool
          .connect(shorters[j])
          .execute(CallType.DepositQuote, shortersQuoteDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 }
        )
      ).wait();
      logger.info(`Short`);
      await(
        await marginlyPool
          .connect(shorters[j])
          .execute(CallType.Short, shortersBaseDebt[j], 0, false, ZERO_ADDRESS, { gasLimit: 500_000 }
        )
      ).wait();
      console.log(`WETH balance after short ${formatUnits(await weth.balanceOf(marginlyPool.address), 18)}`);
    }

    const quoteDelevCoeffBefore = BigNumber.from(await marginlyPool.quoteDelevCoeff());
    const baseDebtCoeffBefore = BigNumber.from(await marginlyPool.baseDebtCoeff());

    logger.info(`  Toggle liquidation`)
  
    await marginlyPool.connect(treasury).setParameters(paramsLowLeverage, { gasLimit: 500_000 });

    nextDate += timeDelta;
    await provider.mineAtTimestamp(nextDate);
    await(await marginlyPool.connect(treasury).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })).wait();

    await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage, { gasLimit: 500_000 });

    const quoteDelevCoeffAfter = BigNumber.from(await marginlyPool.quoteDelevCoeff());
    const baseDebtCoeffAfter = BigNumber.from(await marginlyPool.baseDebtCoeff());

    assert(!quoteDelevCoeffBefore.eq(quoteDelevCoeffAfter));
    assert(!baseDebtCoeffBefore.eq(baseDebtCoeffAfter));
    logger.info(`  Liquidation happened`);
    logger.info(`  quoteDelevCoeffAfter = ${quoteDelevCoeffAfter}`);
    logger.info(`  baseDebtCoeffAfter = ${baseDebtCoeffAfter}`);

    console.log(`WETH balance after liquidation ${formatUnits(await weth.balanceOf(marginlyPool.address), 18)}`);

    for(let j = 0; j < shortersNum; ++j) {
      await marginlyPool
        .connect(shorters[j])
        .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

      console.log(`WETH balance after closePosition ${formatUnits(await weth.balanceOf(marginlyPool.address), 18)}`);

      await marginlyPool
        .connect(shorters[j])
        .execute(CallType.WithdrawQuote, parseUnits('200000', 6), 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
    }
  }
}
