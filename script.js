let chart;

const coinMap = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    DOGE: "dogecoin",
    ADA: "cardano",
    XRP: "ripple",
    BNB: "binancecoin"
};

async function getRealPrices(symbol) {
    let coinId = coinMap[symbol];

    if (!coinId) {
        alert("Supported symbols: BTC, ETH, SOL, DOGE, ADA, XRP, BNB");
        return null;
    }

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30`;

    const response = await fetch(url);
    const data = await response.json();

    return data.prices.map(item => Number(item[1].toFixed(2)));
}

function calculateMovingAverage(prices, period) {
    let recentPrices = prices.slice(-period);
    let sum = recentPrices.reduce((total, price) => total + price, 0);
    return Number((sum / period).toFixed(2));
}

function calculateRSI(prices) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < prices.length; i++) {
        let difference = prices[i] - prices[i - 1];

        if (difference > 0) {
            gains += difference;
        } else {
            losses += Math.abs(difference);
        }
    }

    if (losses === 0) {
        return 100;
    }

    let rs = gains / losses;
    let rsi = 100 - (100 / (1 + rs));

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

function drawChart(prices, symbol) {
    const ctx = document.getElementById("priceChart");

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: prices.map((_, index) => index + 1),
            datasets: [{
                label: symbol + " Real Price",
                data: prices,
                borderWidth: 3,
                tension: 0.3,
                fill: false
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

async function generateSignal() {
    let symbol = document.getElementById("symbolInput").value.toUpperCase();

    if (symbol === "") {
        alert("Please enter a market symbol.");
        return;
    }

    document.getElementById("strategyText").textContent = "Loading real market data...";

    let prices = await getRealPrices(symbol);

    if (!prices) {
        return;
    }

    drawChart(prices, symbol);

    let shortMA = calculateMovingAverage(prices, 5);
    let longMA = calculateMovingAverage(prices, 20);
    let rsi = calculateRSI(prices);

    let signal = "HOLD";
    let strategy = "";
    let trend = "";

    let differencePercent = ((shortMA - longMA) / longMA) * 100;

    if (differencePercent > 0.3 && rsi >= 40 && rsi <= 65) {
        signal = "BUY";
        trend = "Bullish";
        strategy = `${symbol} shows a possible BUY setup. Short MA is clearly above Long MA, and RSI is in a healthy range.`;
    } else if (differencePercent < -0.3 && rsi >= 35 && rsi <= 60) {
        signal = "SELL";
        trend = "Bearish";
        strategy = `${symbol} shows a possible SELL setup. Short MA is clearly below Long MA, and momentum is weakening.`;
    } else {
        signal = "HOLD";
        trend = "Neutral";
        strategy = `${symbol} does not have a strong enough setup right now. The safer signal is HOLD.`;
    }

    let confidence = calculateConfidence(differencePercent, rsi, signal);

    let signalOutput = document.getElementById("signalOutput");

    signalOutput.textContent = signal;
    signalOutput.className = "signal " + signal.toLowerCase();

    document.getElementById("strategyText").textContent = strategy;
    document.getElementById("shortMA").textContent = shortMA;
    document.getElementById("longMA").textContent = longMA;
    document.getElementById("rsiValue").textContent = rsi;
    document.getElementById("trendValue").textContent = trend;
    document.getElementById("confidenceValue").textContent = confidence + "%";
}