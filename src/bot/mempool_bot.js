import {
    provider,
    eip55,
    decodeAbi

} from '../util/web3util.js';

import { WebSocketServer } from 'ws';
import { sendToAll } from '../util/wsutil.js';

import { ABI_PANCAKE_SMART_ROUTER } from '../abi/pancake_smart_router.js';
import { ABI_PANCAKE_ROUTER_V2 } from '../abi/pancake_v2_router.js';
import { PANCAKE_POOL_MANAGER } from '../abi/pancake_pool_manager.js';
import { ABI_UNISWAP_V2_FACTORY } from '../abi/uniswap_v2_factory.js';

BigInt.prototype.toJSON = function() { return this.toString() }

const ZERO = '0x0000000000000000000000000000000000000000'
const CONTRACTS = {
    '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4': {
        name: 'PancakeSwap: Smart Router',
        abi: ABI_PANCAKE_SMART_ROUTER,
        version: 'pancake-v3',
        type: 'router'
    },
    '0x10ED43C718714eb63d5aA57B78B54704E256024E': {
        name: 'PancakeSwap: Router V2',
        abi: ABI_PANCAKE_ROUTER_V2,
        version: 'pancake-v2',
        type: 'router'
    },
    '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73': {
        name: 'PancakeSwap: Factory V2',
        abi: ABI_UNISWAP_V2_FACTORY
    },
    '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364': {
        name: 'PancakeSwap: NonfungiblePositionManager',
        abi: PANCAKE_POOL_MANAGER,
        version: 'pancake-v3',
        type: 'liquidity-manager'
    }
};

const CHAIN = {
    "name": "BSC",
    "symbol": "BNB",
    "decimals": 18,
    "chainId": 56,
    "rpc": "https://bsc-dataseed4.defibit.io/",
    // "rpc": "http://54.151.254.92:8545",
    "explorer": "https://bscscan.com",
    "icon": "https://assets.trustwalletapp.com/blockchains/smartchain/info/logo.png?v=1602812365",
    "pollingInterval": 1
}

const wss = new WebSocketServer({ port: 5000 });

function publish(type, object) {
    console.log('publish: ', type, object);
    sendToAll(wss, JSON.stringify({
        'type': type,
        'data': object
    }));
}

function main() {

    const _provider = provider(CHAIN.rpc);
    _provider.on('pending', async (tx) => {
        const txInfo = await _provider.getTransaction(tx);
        if (!txInfo || !txInfo.to) {
            return;
        }
        const to = eip55(txInfo.to);

        if (txInfo && txInfo.to && CONTRACTS[to]) {
            // console.log('Pancake Smart Router:', txInfo);
            const data = txInfo.data;
            const abi = CONTRACTS[to].abi;
            const name = CONTRACTS[to].name;

            console.log('name: ', name);

            if (data && data !== '0x') {

                console.log('blocknumber: ', txInfo.blockNumber);
                console.log('hash: ', txInfo.hash);
                console.log('from: ', txInfo.from);
                console.log('gasLimit: ', txInfo.gasLimit);
                console.log('gasPrice: ', txInfo.gasPrice);
                console.log('maxPriorityFeePerGas: ', txInfo.maxPriorityFeePerGas);
                console.log('maxFeePerGas: ', txInfo.maxFeePerGas);
                console.log('value: ', txInfo.value);
                // console.log('data: ', data);
                const decoded = decodeAbi(abi, data);
                if (!decoded) {
                    console.log('decoded is null');
                    return;
                }
                console.log('call name: ', decoded.name);

                if (decoded.name == 'multicall'
                    && CONTRACTS[to].version == 'pancake-v3'
                    && CONTRACTS[to].type === 'router') {
                    // pancake smart router call
                    const args = decoded.args;

                    if (args && args.length > 0) {
                        args.forEach((arg) => {
                            // console.log('arg: ', arg);
                            if (typeof arg === 'object') {
                                let out = [];
                                // exactInput*/exactOutput* 和 swap* 分别是v3 和v2的方法。 顺序也有可能前后颠倒，因此这里需要做个处理
                                // 处理方法：
                                // 1，逐个获取每个方法的输入和输出token，第一个方法的输入token和amount视作整个交易的输入
                                // 2，最后一个方法的输出token和amount视作整个交易的输出
                                // 3，中间的方法的输入token和amount视作中间的交易，中间交易暂时不获取

                                arg.forEach((item) => {
                                    const method = item.toString().substring(0, 10);
                                    const params = decodeAbi(abi, item.toString());

                                    console.log("calldata method: ", params.name)
                                    // console.log("calldata params: ", params.args)

                                    if (params.name === 'exactInput' || params.name === 'exactOutput') {
                                        // 填进去_amount0个token0

                                        const _token0 = eip55(params.args[0][0].substring(0, 42));
                                        // const _feeRate = params.args[0][0].substring(42, 48);

                                        // 最后40位
                                        const _token1 = params.args[0][0].substring(params.args[0][0].length - 40, params.args[0][0]);

                                        // const _amount0 = params.args[0][2];
                                        // const _amount1 = params.args[0][3]

                                        const { _amount0, _amount1 } = params.name === 'exactInput' ?
                                            { _amount0: params.args[0][2], _amount1: params.args[0][3] }
                                            : { _amount0: params.args[0][3], _amount1: params.args[0][2] }

                                        out.push({
                                            'token0': _token0,
                                            'amount0': _amount0
                                        })
                                        out.push({
                                            'token1': _token1,
                                            'amount1': _amount1
                                        })

                                    } else if (params.name === 'exactInputSingle'
                                        || params.name === 'exactOutputSingle') {
                                        /*
                                        struct ExactInputSingleParams {
                                            address tokenIn;
                                            address tokenOut;
                                            uint24 fee;
                                            address recipient;
                                            uint256 amountIn;
                                            uint256 amountOutMinimum;
                                            uint160 sqrtPriceLimitX96;
                                        }
                                         struct ExactOutputSingleParams {
                                            address tokenIn;
                                            address tokenOut;
                                            uint24 fee;
                                            address recipient;
                                            uint256 amountOut;
                                            uint256 amountInMaximum;
                                            uint160 sqrtPriceLimitX96;
                                        }
                                        */
                                        const _token0 = eip55(params.args[0][0]);
                                        const _token1 = eip55(params.args[0][1]);

                                        // const {_token0_, _token1_} = params.name === 'exactInputSingle' ?
                                        //     { _token0_: _token1, _token1_: _token0 }
                                        //     : { _token0_: _token0, _token1_: _token1 }
                                        // const _amount0 = params.args[0][4];
                                        // const _amount1 = params.args[0][5];

                                        const { _amount0, _amount1 } = params.name === 'exactInputSingle' ?
                                            { _amount0: params.args[0][4], _amount1: params.args[0][5] }
                                            : { _amount0: params.args[0][5], _amount1: params.args[0][4] }

                                        out.push({
                                            'token0': _token0,
                                            'amount0': _amount0
                                        })
                                        out.push({
                                            'token1': _token1,
                                            'amount1': _amount1
                                        })

                                        // } else if (params.name === 'exactOutputSingle') {
                                        /*
                                        struct ExactOutputSingleParams {
                                            address tokenIn;
                                            address tokenOut;
                                            uint24 fee;
                                            address recipient;
                                            uint256 amountOut;
                                            uint256 amountInMaximum;
                                            uint160 sqrtPriceLimitX96;
                                        }
                                        */

                                    } else if (
                                        params.name === 'swapExactTokensForTokens'
                                        || params.name === 'swapTokensForExactTokens'
                                    ) {

                                        const _token0 = eip55(params.args[2][0]);
                                        // const _amount0 = params.args[0];
                                        // const _amount1 = params.args[1];

                                        const { _amount0, _amount1 } = params.name === 'swapExactTokensForTokens' ?
                                            { _amount0: params.args[0], _amount1: params.args[1] }
                                            : { _amount0: params.args[1], _amount1: params.args[0] }

                                        const _token1 = eip55(params.args[2][params.args[2].length - 1]);

                                        out.push({
                                            'token0': _token0,
                                            'amount0': _amount0
                                        })
                                        out.push({
                                            'token1': _token1,
                                            'amount1': _amount1
                                        })

                                    } else if (params.name === 'unwrapWETH9' || params.name === 'refundETH') {

                                    } else {
                                        console.log('method: ', method, ' params: ', params);
                                    }
                                })
                                // trade route to string
                                if (out.length > 1) {
                                    console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                                    console.log(' Input  ', out[0].amount0, ' [' + out[0].token0 + '] ')
                                    console.log(' For ', out[out.length - 1].amount1, ' [' + out[out.length - 1].token1 + '] ')
                                    console.log(' Hash ', txInfo.hash)

                                    publish('trade', {
                                        'account': eip55(txInfo.from),
                                        'tx': txInfo,
                                        'token0': out[0].token0,
                                        'token1': out[out.length - 1].token1,
                                        'amount0': out[0].amount0,
                                        'amount1': out[out.length - 1].amount1,
                                    })
                                } else {
                                    console.error('out.length <= 1', txInfo.hash, out);
                                }
                            }
                        })
                    }
                } else if ((decoded.name === 'swapExactTokensForTokens'
                    || decoded.name === 'swapTokensForExactTokens'
                    || decoded.name === 'swapExactETHForTokens'
                    || decoded.name === 'swapTokensForExactETH'
                    || decoded.name === 'swapExactTokensForETH'
                    || decoded.name === 'swapETHForExactTokens'
                    || decoded.name === 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
                    || decoded.name === 'swapExactTokensForETHSupportingFeeOnTransferTokens'
                    || decoded.name === 'swapTokensForExactTokensSupportingFeeOnTransferTokens'
                ) && CONTRACTS[to].version === 'pancake-v2'
                    && CONTRACTS[to].type === 'router'
                ) {
                    // v2 router的交易事件
                    let amount0 = null;
                    let amount1 = null;
                    let token0 = null;
                    let token1 = null;

                    // console.log('v2 router call: ', decoded);

                    // swapExactTokensForTokens
                    if (decoded.name === 'swapExactTokensForTokens') {
                        // 固定out，变in
                        amount0 = decoded.args[0];
                        amount1 = decoded.args[1];

                        token0 = eip55(decoded.args[2][0]);
                        token1 = eip55(decoded.args[2][decoded.args[2].length - 1]);
                    } else if (decoded.name === 'swapTokensForExactTokens') {
                        // 固定in，变out
                        amount0 = decoded.args[1];
                        amount1 = decoded.args[0];

                        token0 = eip55(decoded.args[2][0]);
                        token1 = eip55(decoded.args[2][decoded.args[2].length - 1]);

                    } else if (decoded.name === 'swapExactETHForTokens') {
                        amount0 = txInfo.value
                        token0 = ZERO

                        amount1 = decoded.args[0]
                        token1 = eip55(decoded.args[1][decoded.args[1].length - 1])
                    } else if (decoded.name === 'swapTokensForExactETH') {
                        amount0 = decoded.args[1]
                        token0 = eip55(decoded.args[2][0])

                        amount1 = decoded.args[0]
                        token1 = ZERO
                    } else if (decoded.name === 'swapExactETHForTokensSupportingFeeOnTransferTokens') {
                        // Receive as many output tokens as possible for an exact amount of BNB. Supports tokens that take a fee on transfer.
                        // TODO something error
                        amount0 = txInfo.value
                        token0 = ZERO

                        amount1 = decoded.args[0]
                        token1 = eip55(decoded.args[1][decoded.args[1].length - 1])

                    } else if (decoded.name === 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
                        // Receive as much BNB as possible for an exact amount of tokens. Supports tokens that take a fee on transfer.
                        amount0 = decoded.args[0]
                        amount1 = decoded.args[1]

                        token0 = eip55(decoded.args[2][0])
                        token1 = ZERO

                    } else if (decoded.name === 'swapExactTokensForTokensSupportingFeeOnTransferTokens') {
                        // Receive as many output tokens as possible for an exact amount of input tokens. Supports tokens that take a fee on transfer.
                        amount0 = decoded.args[0]
                        amount1 = decoded.args[1]

                        token0 = eip55(decoded.args[2][0])
                        token1 = eip55(decoded.args[2][decoded.args[2].length - 1])
                    }

                    console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                    console.log(' Input  ', amount0, ' [' + token0 + '] ')
                    console.log(' For ', amount1, ' [' + token1 + '] ')
                    console.log(' Hash ', txInfo.hash)

                    publish('trade', {
                        'account': eip55(txInfo.from),
                        'tx': txInfo,
                        'token0': token0,
                        'token1': token1,
                        'amount0': amount0,
                        'amount1': amount1,
                    })
                } else if ((decoded.name === 'addLiquidity'
                    || decoded.name === 'addLiquidityETH'
                    // || decoded.name === 'removeLiquidity'
                    // || decoded.name === 'removeLiquidityETH'
                    // || decoded.name === 'removeLiquidityWithPermit'
                    // || decoded.name === 'removeLiquidityETHWithPermit'
                    // || decoded.name === 'removeLiquidityETHSupportingFeeOnTransferTokens'
                    // || decoded.name === 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens'
                )
                    && CONTRACTS[to].version === 'pancake-v2'
                    && CONTRACTS[to].type === 'router'
                ) {
                    // add / remove liquidity
                    let token0 = null;
                    let token1 = null;

                    let amount0desired = null;
                    let amount1desired = null;

                    let amount0min = null;
                    let amount1min = null;

                    let lpAddress = null;

                    if (decoded.name === 'addLiquidity') {
                        token0 = eip55(decoded.args[0]);
                        token1 = eip55(decoded.args[1]);

                        amount0desired = decoded.args[2];
                        amount1desired = decoded.args[3];

                        amount0min = decoded.args[4];
                        amount1min = decoded.args[5];

                        lpAddress = eip55(decoded.args[6]);
                    } else if (decoded.name === 'addLiquidityETH') {
                        token0 = ZERO;
                        token1 = eip55(decoded.args[0]);

                        amount0desired = txInfo.value
                        amount1desired = decoded.args[1];

                        amount0min = decoded.args[3];
                        amount1min = decoded.args[2];

                        lpAddress = eip55(decoded.args[4]);
                    }
                    console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                    console.log(' Add LP To Pair ', lpAddress)
                    console.log(' Token 0 Desire ', amount0desired, ' [' + token0 + '] ')
                    console.log(' Token 0 Min ', amount0min, ' [' + token0 + '] ')

                    console.log(' Token 1 Desire ', amount1desired, ' [' + token1 + '] ')
                    console.log(' Token 1 Min ', amount1min, ' [' + token1 + '] ')

                    publish('addLiquidity', {
                        'version': 'v2',
                        'account': eip55(txInfo.from),
                        'tx': txInfo,
                        'token0': token0,
                        'token1': token1,
                        'amount0desired': amount0desired,
                        'amount1desired': amount1desired,
                        'amount0min': amount0min,
                        'amount1min': amount1min,
                        'lpAddress': lpAddress,
                    })
                } else if ((
                    decoded.name === 'removeLiquidity'
                    || decoded.name === 'removeLiquidityETH'
                    || decoded.name === 'removeLiquidityWithPermit'
                    || decoded.name === 'removeLiquidityETHWithPermit'
                    || decoded.name === 'removeLiquidityETHSupportingFeeOnTransferTokens'
                    || decoded.name === 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens'
                )
                    && CONTRACTS[to].version === 'pancake-v2'
                    && CONTRACTS[to].type === 'router'
                ) {
                    let token0 = null;
                    let token1 = null;

                    let amount0 = null;
                    let amount1 = null;

                    let liquidity = null;
                    // TODO v2 remove liquidity
                    if (decoded.name === 'removeLiquidity') {

                        token0 = eip55(decoded.args[0]);
                        token1 = eip55(decoded.args[1]);

                        liquidity = decoded.args[2];
                        amount0 = decoded.args[3];
                        amount1 = decoded.args[4];

                    } else if (decoded.name === 'removeLiquidityETH') {

                        token0 = ZERO;
                        token1 = eip55(decoded.args[0]);

                        liquidity = decoded.args[1];
                        amount0 = decoded.args[3];
                        amount1 = decoded.args[2];
                    } else if (decoded.name === 'removeLiquidityWithPermit') {

                        token0 = eip55(decoded.args[0]);
                        token1 = eip55(decoded.args[1]);

                        liquidity = decoded.args[2];
                        amount0 = decoded.args[3];
                        amount1 = decoded.args[4];

                    } else if (decoded.name === 'removeLiquidityETHWithPermit') {

                        token0 = ZERO;
                        token1 = eip55(decoded.args[0]);

                        liquidity = decoded.args[1];
                        amount0 = decoded.args[3];
                        amount1 = decoded.args[2];
                    } else if (decoded.name === 'removeLiquidityETHSupportingFeeOnTransferTokens') {

                        token0 = ZERO;
                        token1 = eip55(decoded.args[0]);

                        liquidity = decoded.args[1];
                        amount0 = decoded.args[3];
                        amount1 = decoded.args[2];
                    } else if (decoded.name === 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens') {

                        token0 = ZERO;
                        token1 = eip55(decoded.args[0]);

                        liquidity = decoded.args[1];
                        amount0 = decoded.args[3];
                        amount1 = decoded.args[2];
                    } else {
                        console.log('unrec remove liquidity: ', decoded);
                    }

                    console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                    console.log(' Remove LP From Pair ')
                    console.log(' Token 0 ', amount0, ' [' + token0 + '] ')
                    console.log(' Token 1 ', amount1, ' [' + token1 + '] ')
                    console.log(' Liquidity Removed ', liquidity)

                    publish('removeLiquidity', {
                        'version': 'v2',
                        'account': eip55(txInfo.from),
                        'tx': txInfo,
                        'token0': token0,
                        'token1': token1,
                        'amount0': amount0,
                        'amount1': amount1,
                        'liquidity': liquidity,
                    })

                } else if (CONTRACTS[to].version === 'pancake-v3'
                    && CONTRACTS[to].type === 'liquidity-manater'
                ) {
                    // V3 liquidity manager
                    console.log('V3 liquidity manager: ', decoded);
                    if (decoded.name === 'multicall') {

                        // console.log('multicall: ', decoded.args);
                        const params = decoded.args[0];

                        if (!params || params.length === 0) {
                            return;
                        }
                        params.forEach((item) => {
                            const call = decodeAbi(CONTRACTS[to].abi, item.toString());
                            // console.log('call: ', call);
                            if (call.name === 'decreaseLiquidity') {
                                const args = call.args[0];
                                const tokenId = args[0];
                                const liquidity = args[1];
                                const amount0Min = args[2];
                                const amount1Min = args[3];

                                console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                                console.log(' Remove LP From Pair(Multicall) ', tokenId)
                                console.log(' Liquidity Removed ', liquidity)
                                console.log(' Token 0 Min ', amount0Min)
                                console.log(' Token 1 Min ', amount1Min)

                                publish('removeLiquidity', {
                                    'version': 'v3',
                                    'account': eip55(txInfo.from),
                                    'tx': txInfo,
                                    'lpToken': tokenId,
                                    'amount0': amount0Min,
                                    'amount1': amount1Min,
                                    'liquidity': liquidity,
                                })

                            } else if (call.name === 'increaseLiquidity') {
                                const tokenId = call.args[0];
                                const amount0Desired = call.args[1];
                                const amount1Desired = call.args[2];

                                const amount0Min = call.args[3];
                                const amount1Min = call.args[4];

                                console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                                console.log(' Add LP To Pair(Multicall) ', tokenId)
                                console.log(' Token 0 Desire ', amount0Desired, ' [' + token0 + '] ')
                                console.log(' Token 0 Min ', amount0Min, ' [' + token0 + '] ')

                                console.log(' Token 1 Desire ', amount1Desired, ' [' + token1 + '] ')
                                console.log(' Token 1 Min ', amount1Min, ' [' + token1 + '] ')

                                publish('addLiquidity', {
                                    'version': 'v3',
                                    'account': eip55(txInfo.from),
                                    'tx': txInfo,
                                    'lpToken': tokenId,
                                    'amount0desired': amount0Desired,
                                    'amount1desired': amount1Desired,
                                    'amount0min': amount0Min,
                                    'amount1min': amount1Min,
                                });

                            } else if (call.name === 'mint') {
                                const args = call.args[0];

                                const token0 = eip55(args[0]);
                                const token1 = eip55(args[1]);

                                const fee = args[2];
                                const tickLower = args[3];
                                const tickUpper = args[4];

                                const amount0Desired = args[5];
                                const amount1Desired = args[6];

                                const amount0Min = args[7];
                                const amount1Min = args[8];

                                const recipient = eip55(args[9]);

                                console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                                console.log(' Create LP To Pair(Multicall) ')
                                console.log(' Token 0 Desire ', amount0Desired, ' [' + token0 + '] ')
                                console.log(' Token 0 Min ', amount0Min, ' [' + token0 + '] ')

                                console.log(' Token 1 Desire ', amount1Desired, ' [' + token1 + '] ')
                                console.log(' Token 1 Min ', amount1Min, ' [' + token1 + '] ')

                                console.log(' Fee ', fee)
                                console.log(' Tick Lower ', tickLower)
                                console.log(' Tick Upper ', tickUpper)
                                console.log(' Recipient ', recipient)

                                publish('createLiquidity', {
                                    'version': 'v3',
                                    'account': eip55(txInfo.from),
                                    'tx': txInfo,
                                    'token0': token0,
                                    'token1': token1,
                                    'amount0desired': amount0Desired,
                                    'amount1desired': amount1Desired,
                                    'amount0min': amount0Min,
                                    'amount1min': amount1Min,
                                    'fee': fee,
                                    'tickLower': tickLower,
                                    'tickUpper': tickUpper,
                                    'recipient': recipient,
                                })

                            }
                        })

                    } else if (decoded.name === 'mint') {
                        // 新上token流动性？
                        const args = decoded.args[0];

                        const token0 = eip55(args[0]);
                        const token1 = eip55(args[1]);

                        const fee = args[2];
                        const tickLower = args[3];
                        const tickUpper = args[4];

                        const amount0Desired = args[5];
                        const amount1Desired = args[6];

                        const amount0Min = args[7];
                        const amount1Min = args[8];

                        const recipient = eip55(args[9]);

                        console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                        console.log(' Create LP To Pair ')
                        console.log(' Token 0 Desire ', amount0Desired, ' [' + token0 + '] ')
                        console.log(' Token 0 Min ', amount0Min, ' [' + token0 + '] ')

                        console.log(' Token 1 Desire ', amount1Desired, ' [' + token1 + '] ')
                        console.log(' Token 1 Min ', amount1Min, ' [' + token1 + '] ')

                        console.log(' Fee ', fee)
                        console.log(' Tick Lower ', tickLower)
                        console.log(' Tick Upper ', tickUpper)
                        console.log(' Recipient ', recipient)

                        publish('createLiquidity', {
                            'version': 'v3',
                            'account': eip55(txInfo.from),
                            'tx': txInfo,
                            'token0': token0,
                            'token1': token1,
                            'amount0desired': amount0Desired,
                            'amount1desired': amount1Desired,
                            'amount0min': amount0Min,
                            'amount1min': amount1Min,
                            'fee': fee,
                            'tickLower': tickLower,
                            'tickUpper': tickUpper,
                            'recipient': recipient,
                        });


                    } else if (decoded.name === 'increaseLiquidity') {
                        // 增加流动性, token id 是流动性id
                        const args = decoded.args[0];

                        const tokenId = args[0];
                        const amount0Desired = args[1];
                        const amount1Desired = args[2];

                        const amount0Min = args[3];
                        const amount1Min = args[4];

                        console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                        console.log(' Add LP To Pair ', tokenId)
                        console.log(' Token 0 Desire ', amount0Desired, ' [' + token0 + '] ')
                        console.log(' Token 0 Min ', amount0Min, ' [' + token0 + '] ')
                        console.log(' Token 1 Desire ', amount1Desired, ' [' + token1 + '] ')
                        console.log(' Token 1 Min ', amount1Min, ' [' + token1 + '] ')

                        publish('addLiquidity', {
                            'version': 'v3',
                            'account': eip55(txInfo.from),
                            'tx': txInfo,
                            'lpToken': tokenId,
                            'amount0desired': amount0Desired,
                            'amount1desired': amount1Desired,
                            'amount0min': amount0Min,
                            'amount1min': amount1Min,
                        });


                    } else if (decoded.name === 'decreaseLiquidity') {
                        const args = decoded.args[0];
                        // 减少流动性
                        const tokenId = args[0];
                        const liquidity = args[1];
                        const amount0Min = args[2];
                        const amount1Min = args[3];

                        console.log('[', CONTRACTS[to].name, ']', ' Account:', eip55(txInfo.from))
                        console.log(' Remove LP From Pair ', tokenId)
                        console.log(' Liquidity Removed ', liquidity)
                        console.log(' Token 0 Min ', amount0Min)
                        console.log(' Token 1 Min ', amount1Min)

                        publish('removeLiquidity', {
                            'version': 'v3',
                            'account': eip55(txInfo.from),
                            'tx': txInfo,
                            'lpToken': tokenId,
                            'amount0': amount0Min,
                            'amount1': amount1Min,
                            'liquidity': liquidity,
                        })
                    }
                }
                console.log('===================================================================');
            }
        }

    }).catch((err) => {

    });

    wss.on('connection', (ws) => {
        ws.on('open', () => {
            console.log('connected');
        });
        ws.on('error', (error) => {
            console.log(error);
        });
    });
}

main();