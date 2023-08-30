// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './abstract/AdapterCallback.sol';
import './abstract/RouterStorage.sol';
import './interfaces/IMarginlyRouter.sol';
import './interfaces/IMarginlyAdapter.sol';
import './libraries/SwapsDecoder.sol';

contract MarginlyRouter is RouterStorage, AdapterCallback {
  constructor(AdapterInput[] memory _adapters) RouterStorage(_adapters) {}

  /// @inheritdoc IMarginlyRouter
  function swapExactInput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    require(amountIn != 0, 'zero amount');

    (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 swapsNumber) = SwapsDecoder.decodeSwapInfo(
      swapCalldata,
      amountIn,
      minAmountOut
    );

    for (uint256 i; i < swapsNumber; ++i) {
      SwapsDecoder.SwapInfo memory swapInfo = swapInfos[i];
      uint256 dexIndex = swapInfo.dexIndex;
      uint256 dexAmountIn = swapInfo.dexAmountIn;

      AdapterCallbackData memory data = AdapterCallbackData({payer: msg.sender, tokenIn: tokenIn, dexIndex: dexIndex});
      uint256 dexAmountOut = getAdapterSafe(dexIndex).swapExactInput(
        msg.sender,
        tokenIn,
        tokenOut,
        dexAmountIn,
        swapInfo.dexAmountOut,
        data
      );

      amountOut += dexAmountOut;
      emit Swap(true, dexIndex, msg.sender, tokenIn, tokenOut, dexAmountIn, dexAmountOut);
    }
  }

  /// @inheritdoc IMarginlyRouter
  function swapExactOutput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256 amountIn) {
    require(amountOut != 0, 'zero amount');

    (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 swapsNumber) = SwapsDecoder.decodeSwapInfo(
      swapCalldata,
      maxAmountIn,
      amountOut
    );

    for (uint256 i; i < swapsNumber; ++i) {
      SwapsDecoder.SwapInfo memory swapInfo = swapInfos[i];
      uint256 dexIndex = swapInfo.dexIndex;
      uint256 dexAmountOut = swapInfo.dexAmountOut;

      AdapterCallbackData memory data = AdapterCallbackData({payer: msg.sender, tokenIn: tokenIn, dexIndex: dexIndex});
      uint256 dexAmountIn = getAdapterSafe(dexIndex).swapExactOutput(
        msg.sender,
        tokenIn,
        tokenOut,
        swapInfo.dexAmountIn,
        dexAmountOut,
        data
      );

      amountIn += dexAmountIn;
      emit Swap(false, dexIndex, msg.sender, tokenIn, tokenOut, dexAmountIn, dexAmountOut);
    }
  }

  /// @inheritdoc IMarginlyRouter
  function adapterCallback(address recipient, uint256 amount, AdapterCallbackData calldata data) external {
    adapterCallbackInner(recipient, amount, data);
  }
}
