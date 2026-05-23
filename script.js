let chart;
let isLoading = false;

const coinMap = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    DOGE: "dogecoin",
    ADA: "cardano",
    XRP: "ripple",
    BNB: "binancecoin"
};

async function getMarketData(symbol, days) {
    const coinId = coinMap[symbol];

    if (!coinId) {
        alert("Supported symbols: BTC, ETH, SOL, DOGE, ADA, XRP, BNB");
        return null;
    }

    const url =
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Market data request failed.");
    }

    const data = await response.json();

    if (!data.prices || data.prices.length < 20) {
        throw new Error("Not enough market data received.");
    }

    const rawPrices = data.prices;
    const prices = rawPrices.map(item => Number(item[1].toFixed(2)));

    const candles = [];

    for (let i = 1; i < rawPrices.length; i++) {
        const previousPrice = Number(rawPrices[i - 1][1].toFixed(2));
        const currentPrice = Number(rawPrices[i][1].toFixed(2));

        const high = Math.max(previousPrice, currentPrice);
        const low = Math.min(previousPrice, currentPrice);

        candles.push({
            x: rawPrices[i][0],
            o: previousPrice,
            h: high,
            l: low,
            c: currentPrice
        });
    }

    return {
        prices,
        candles
    };
}

function calculateMovingAverage(prices, period) {
    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((total, price) => total + price, 0);
    return Number((sum / period).toFixed(2));
}

function calculateRSI(prices) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];

        if (difference > 0) {
            gains += difference;
        } else {
            losses += Math.abs(difference);
        }
    }

    if (losses === 0) {
        return 100;
    }

    const rs = gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    return Number(rsi.toFixed(2));
}

function calculateConfidence(differencePercent, rsi, signal) {
    let confidence = 50;

    confidence += Math.min(Math.abs(differencePercent) * 10, 25);

    if (signal === "BUY") {
        if (rsi >= 45 && rsi <= 60) {
            confidence += 20;
        } else {
            confidence += 10;
        }
    } else if (signal === "SELL") {
        if (rsi >= 40 && rsi <= 55) {
            confidence += 20;
        } else {
            confidence += 10;
        }
    } else {
        confidence = 45;
    }

    if (confidence > 95) {
        confidence = 95;
    }

    return Math.round(confidence);
}

function drawChart(candles, symbol, days) {
    const ctx = document.getElementById("priceChart");

    if (chart) {
        chart.destroy();
    }

    let timeUnit = "day";

    if (days === "1") {
        timeUnit = "hour";
    }

    chart = new Chart(ctx, {
        type: "candlestick",
        data: {
            datasets: [{
                label: `${symbol} Candlestick Chart (${days}D)`,
                data: candles
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: "white"
                    }
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        unit: timeUnit
                    },
                    ticks: {
                        color: "white"
                    }
                },
                y: {
                    ticks: {
                        color: "white"
                    }
                }
            }
        }
    });
}

function addSignalHistory(symbol, signal, confidence, days) {
    const history = document.getElementById("history");
    const item = document.createElement("p");
    const time = new Date().toLocaleTimeString();

    item.innerHTML = `${time} | ${symbol} | ${days}D → ${signal} → ${confidence}%`;

    history.prepend(item);

    if (history.children.length > 10) {
        history.removeChild(history.lastChild);
    }
}

function analyzeSignal(symbol, prices) {
    const shortMA = calculateMovingAverage(prices, 5);
    const longMA = calculateMovingAverage(prices, 20);
    const rsi = calculateRSI(prices);

    let signal = "HOLD";
    let trend = "Neutral";
    let strategy = `${symbol} does not currently have a strong setup.`;

    const differencePercent = ((shortMA - longMA) / longMA) * 100;

    if (differencePercent > 0.3 && rsi >= 40 && rsi <= 65) {
        signal = "BUY";
        trend = "Bullish";
        strategy = `${symbol} shows a possible BUY setup. Short MA is above Long MA and RSI is healthy.`;
    } else if (differencePercent < -0.3 && rsi >= 35 && rsi <= 60) {
        signal = "SELL";
        trend = "Bearish";
        strategy = `${symbol} shows a possible SELL setup. Momentum appears weaker.`;
    }

    const confidence = calculateConfidence(differencePercent, rsi, signal);

    return {
        shortMA,
        longMA,
        rsi,
        signal,
        trend,
        strategy,
        confidence
    };
}

async function generateSignal() {
    if (isLoading) {
        return;
    }

    const symbol = document.getElementById("symbolInput").value.toUpperCase().trim();
    const days = document.getElementById("timeframeSelect").value;

    if (symbol === "") {
        alert("Please enter a market symbol.");
        return;
    }

    try {
        isLoading = true;

        document.getElementById("strategyText").textContent = "Loading real market data...";

        const marketData = await getMarketData(symbol, days);

        if (!marketData) {
            document.getElementById("strategyText").textContent = "Could not load market data.";
            return;
        }

        drawChart(marketData.candles, symbol, days);

        const result = analyzeSignal(symbol, marketData.prices);

        const signalOutput = document.getElementById("signalOutput");

        signalOutput.textContent = result.signal;
        signalOutput.className = "signal " + result.signal.toLowerCase();

        document.getElementById("strategyText").textContent = result.strategy;
        document.getElementById("shortMA").textContent = result.shortMA;
        document.getElementById("longMA").textContent = result.longMA;
        document.getElementById("rsiValue").textContent = result.rsi;
        document.getElementById("trendValue").textContent = result.trend;
        document.getElementById("confidenceValue").textContent = result.confidence + "%";

        addSignalHistory(symbol, result.signal, result.confidence, days);

    } catch (error) {
        console.error(error);
        document.getElementById("strategyText").textContent =
            "Error loading data. Try again in a few seconds or check your internet connection.";
    } finally {
        isLoading = false;
    }
}

async function scanMarket() {
    const scanner = document.getElementById("scannerResults");
    const days = document.getElementById("timeframeSelect").value;
    const symbols = ["BTC", "ETH", "SOL", "DOGE", "ADA", "XRP", "BNB"];

    scanner.innerHTML = "<p>Scanning market...</p>";

    try {
        scanner.innerHTML = "";

        for (const symbol of symbols) {
            const marketData = await getMarketData(symbol, days);
            const result = analyzeSignal(symbol, marketData.prices);

            const item = document.createElement("p");
            item.innerHTML = `${symbol} | ${days}D → ${result.signal} → ${result.confidence}%`;
            scanner.appendChild(item);
        }
    } catch (error) {
        console.error(error);
        scanner.innerHTML = "<p>Error scanning market. Try again later.</p>";
    }
}

setInterval(() => {
    const symbol = document.getElementById("symbolInput").value.toUpperCase().trim();

    if (symbol !== "" && !isLoading) {
        generateSignal();
    }
}, 30000);