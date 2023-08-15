const cron = require('node-cron');
const timeZone = 'America/Los_Angeles';  

let currentPeriodADP = 0;

cron.schedule('0 0 * * 1', function(){
  currentPeriodADP = 100000;
  console.log("A new period starts, 100000 ADP will be distributed in this period.");
}, {
  scheduled: true,
  timezone: timeZone
});

module.exports = {
    getCurrentPeriodADP: function() {
        return currentPeriodADP;
    },
    distributeADP: function(amount) {
        if (currentPeriodADP >= amount) {
            currentPeriodADP -= amount;
            return amount;
        } else {
            let distributedADP = currentPeriodADP;
            currentPeriodADP = 0;
            return distributedADP;
        }
    }
};
