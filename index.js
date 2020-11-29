const functions = require('firebase-functions');
const { forEach } = require('p-iteration');
const axios = require('axios')

const admin = require('firebase-admin');
const FieldValue = admin.firestore.FieldValue;
admin.initializeApp();

const bottoken = functions.config().telegram.bottoken;
const channel = functions.config().telegram.channel;
const httptoken = functions.config().http.token;

exports.notifySwaps = functions.firestore.document('/swaps/{documentId}')
    .onWrite(async (change, context) => {
        const docId = context.params.documentId;
        const docs = change.after.data();
        if (docs == undefined) return;

        if (docs.hasOwnProperty('notify') != true || docs['notify'] != true) {
            var url = `https://api.telegram.org/bot${bottoken}/sendMessage`
            var utcDate = new Date(parseInt(docs['transaction']['timestamp']) * 1000);

            var amount0In = parseFloat(docs['amount0In']).toFixed(4);
            var amount0Out = parseFloat(docs['amount0Out']).toFixed(4);
            var amount1In = parseFloat(docs['amount1In']).toFixed(4);
            var amount1Out = parseFloat(docs['amount1Out']).toFixed(4);
            var amountUSD = parseFloat(docs['amountUSD']).toFixed(4);
            var token0Symbol = docs['pair']['token0']['symbol'];
            var token1Symbol = docs['pair']['token1']['symbol'];

            console.log(`amount ${amount0In}`)
            if (amount0In == 0) {
                type = 'Bought'
                price = (amountUSD / amount0Out).toFixed(4)

                text = `
    ${type}
    ${amount0Out} *${token0Symbol}*
    for ${amount1In} *${token1Symbol}*
    ~ ${amountUSD} *USD*
    @price ${price}
    ${utcDate.toUTCString()}
    [Etherscan](https://etherscan.io/tx/${docs['transaction']['id']})
    `
            }
            else {
                type = 'Sold'
                price = (amountUSD / amount0In).toFixed(4)
                text = `
    ${type}
    ${amount0In} *${token0Symbol}*
    for ${amount1Out} *${token1Symbol}*
    ~ ${amountUSD} *USD*
    @price ${price}
    ${utcDate.toUTCString()}
    [Etherscan](https://etherscan.io/tx/${docs['transaction']['id']})
    `
            }

            var body = {
                chat_id: channel,
                disable_web_page_preview: true,
                parse_mode: 'markdown',
                text: text,
            }

            var options = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: body
            };
            try {
                var results = await axios(options);
                await admin.firestore().collection('swaps').doc(docId).set({ 'notify': true }, { merge: true });
            }
            catch (error) {
                await admin.firestore().collection('swaps').doc(docId).set({ 'notify': false }, { merge: true });
            }
        }
    });

exports.notifyMints = functions.firestore.document('/mints/{documentId}')
    .onWrite(async (change, context) => {
        const docId = context.params.documentId;
        const docs = change.after.data();
        if (docs == undefined) return;

        if (docs.hasOwnProperty('notify') != true || docs['notify'] != true) {

            var url = `https://api.telegram.org/bot${bottoken}/sendMessage`;
            var utcDate = new Date(parseInt(docs['transaction']['timestamp']) * 1000);
            var token0Symbol = docs['pair']['token0']['symbol'];
            var token1Symbol = docs['pair']['token1']['symbol'];
            text = `
            Liquidity Added
    ${parseFloat(docs['amount0']).toFixed(4)} *${token0Symbol}*
    ~ ${parseFloat(docs['amount1']).toFixed(4)} *${token1Symbol}*
    ~ ${parseFloat(docs['amountUSD']).toFixed(2)} *USD*
    ${utcDate.toUTCString()}
    [Etherscan](https://etherscan.io/tx/${docs['transaction']['id']})
            `
            var body = {
                chat_id: channel,
                disable_web_page_preview: true,
                parse_mode: 'markdown',
                text: text,
            }

            var options = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: body
            };
            try {
                var results = await axios(options);
                await admin.firestore().collection('mints').doc(docId).set({ 'notify': true }, { merge: true });
            }
            catch (error) {
                await admin.firestore().collection('mints').doc(docId).set({ 'notify': false }, { merge: true });
            }
        }
    });

exports.scan = functions.https.onRequest(async (req, res) => {
    const token = req.query.token;
    const tokenAddr = req.query.tokenAddr;
    const url = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
    const body = "{\"operationName\":null,\"variables\":{\"allPairs\":[\"" + tokenAddr + "\"]},\"query\":\"query ($allPairs: [Bytes]!) {\\n  mints(first: 20, where: {pair_in: $allPairs}, orderBy: timestamp, orderDirection: desc) {\\n    transaction {\\n      id\\n      timestamp\\n      __typename\\n    }\\n    pair {\\n      token0 {\\n        id\\n        symbol\\n        __typename\\n      }\\n      token1 {\\n        id\\n        symbol\\n        __typename\\n      }\\n      __typename\\n    }\\n    to\\n    liquidity\\n    amount0\\n    amount1\\n    amountUSD\\n    __typename\\n  }\\n  burns(first: 20, where: {pair_in: $allPairs}, orderBy: timestamp, orderDirection: desc) {\\n    transaction {\\n      id\\n      timestamp\\n      __typename\\n    }\\n    pair {\\n      token0 {\\n        id\\n        symbol\\n        __typename\\n      }\\n      token1 {\\n        id\\n        symbol\\n        __typename\\n      }\\n      __typename\\n    }\\n    sender\\n    liquidity\\n    amount0\\n    amount1\\n    amountUSD\\n    __typename\\n  }\\n  swaps(first: 30, where: {pair_in: $allPairs}, orderBy: timestamp, orderDirection: desc) {\\n    transaction {\\n      id\\n      timestamp\\n      __typename\\n    }\\n    id\\n    pair {\\n      token0 {\\n        id\\n        symbol\\n        __typename\\n      }\\n      token1 {\\n        id\\n        symbol\\n        __typename\\n      }\\n      __typename\\n    }\\n    amount0In\\n    amount0Out\\n    amount1In\\n    amount1Out\\n    amountUSD\\n    to\\n    __typename\\n  }\\n}\\n\"}"

    if (token == httptoken) {
        var options = {
            method: 'POST',
            url: url,
            data: body
        };
        var results = await axios(options);
        await forEach(results.data.data['mints'], async mint => {
            const writeResult = await admin.firestore().collection('mints').doc(mint['transaction']['id']).set(mint, { merge: true });
        });

        await forEach(results.data.data['swaps'], async swap => {
            const writeResult = await admin.firestore().collection('swaps').doc(swap['transaction']['id']).set(swap, { merge: true });
            console.log(writeResult);
        });
        res.json(results.data);

    } else res.json({ 'status': 'fail' })
});


exports.resend = functions.https.onRequest(async (req, res) => {
    const token = req.query.token;
    if (token == httptoken) {
        const mints = await admin.firestore().collection('mints').where('notify', '==', false).get();
        await mints.forEach(mint => {
            admin.firestore().collection('mints').doc(mint.id).set({ 'notify': FieldValue.delete() }, { merge: true });
        })

        const swaps = await admin.firestore().collection('swaps').where('notify', '==', false).get();
        await swaps.forEach(swap => {
            admin.firestore().collection('swaps').doc(swap.id).set({ 'notify': FieldValue.delete() }, { merge: true });
        })

        res.json();

    } else res.json({ 'status': 'fail' })
});
