import { ethers } from 'ethers'

const provider = (rpc) => {

    if (rpc.startsWith('http')) {
        return new ethers.JsonRpcProvider(rpc)
    } else if (rpc.startsWith('ws')) {
        return new ethers.WebSocketProvider(rpc)
    } else if (rpc.startsWith('/')) {
        return new ethers.IpcSocketProvider(rpc)
    }
    throw new Error('Invalid RPC URL')
}

const eip55 = (address) => {
    // return ethers.utils.getAddress(address)
    return ethers.getAddress(address)
}

const decodeAbi = (abi, data) => {
    // console.log('decodeAbi = ========: ', data)
    const iface = new ethers.Interface(abi)
    return iface.parseTransaction({ data })
}

export {
    provider, 
    eip55, 
    decodeAbi
}