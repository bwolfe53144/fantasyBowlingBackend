function calculateScratchGamePoints(weekScores) {
    return weekScores.reduce((sum, score) => {
      const games = [score.game1, score.game2, score.game3].filter(g => g != null);
      return sum + games.reduce((pts, g) => {
        if (g === 300) return pts + 30;
        if (g < 100) return pts;
        if (g < 125) return pts + 1;
        if (g < 150) return pts + 2;
        if (g < 175) return pts + 3;
        if (g < 199) return pts + 5;
        if (g < 220) return pts + 7;
        if (g < 240) return pts + 9;
        if (g < 260) return pts + 12;
        if (g < 279) return pts + 15;
        if (g < 290) return pts + 18;
        if (g < 300) return pts + 22;
        return pts;
      }, 0);
    }, 0);
  }
  
  function calculateHandicapGamePoints(weekScores) {
    return weekScores.reduce((sum, score) => {
      const avg = score.average;
      const games = [score.game1, score.game2, score.game3].filter(g => g != null);
      return sum + games.reduce((pts, g) => {
        const diff = g - avg;
        if (diff < 0) return pts;
        if (diff < 20) return pts + 5;
        if (diff < 30) return pts + 6;
        if (diff < 40) return pts + 8;
        if (diff < 50) return pts + 10;
        if (diff < 60) return pts + 15;
        if (diff < 70) return pts + 17;
        if (diff < 80) return pts + 19;
        if (diff < 90) return pts + 21;
        if (diff < 100) return pts + 23;
        if (diff < 110) return pts + 30;
        if (diff < 125) return pts + 35;
        return pts + 40;
      }, 0);
    }, 0);
  }
  
  function calculateScratchSeriesPoints(weekScores) {
    return weekScores.reduce((sum, score) => {
      const games = [score.game1, score.game2, score.game3].filter(g => g != null);
      const series = games.reduce((a, b) => a + b, 0);
      if (series >= 800) return sum + 30;
      if (series >= 775) return sum + 21;
      if (series >= 750) return sum + 19;
      if (series >= 725) return sum + 17;
      if (series >= 700) return sum + 15;
      if (series >= 675) return sum + 10;
      if (series >= 650) return sum + 9;
      if (series >= 625) return sum + 8;
      if (series >= 600) return sum + 7;
      if (series >= 550) return sum + 2;
      if (series >= 500) return sum + 1;
      return sum;
    }, 0);
  }
  
  function calculateHandicapSeriesPoints(weekScores) {
    return weekScores.reduce((sum, score) => {
      const avg = score.average;
      const games = [score.game1, score.game2, score.game3].filter(g => g != null);
      const series = games.reduce((a, b) => a + b, 0);
      const diff = series - (avg * games.length);
      if (diff >= 150) return sum + 40;
      if (diff >= 125) return sum + 30;
      if (diff >= 100) return sum + 22;
      if (diff >= 90) return sum + 17;
      if (diff >= 80) return sum + 15;
      if (diff >= 70) return sum + 13;
      if (diff >= 60) return sum + 11;
      if (diff >= 50) return sum + 9;
      if (diff >= 40) return sum + 4;
      if (diff >= 30) return sum + 3;
      if (diff >= 20) return sum + 2;
      if (diff >= 0) return sum + 1;
      return sum;
    }, 0);
  }
  
  function calculateFantasyPoints(weekScores) {
    return (
      calculateScratchGamePoints(weekScores) +
      calculateHandicapGamePoints(weekScores) +
      calculateScratchSeriesPoints(weekScores) +
      calculateHandicapSeriesPoints(weekScores)
    );
  }
  
  module.exports = {
    calculateScratchGamePoints,
    calculateHandicapGamePoints,
    calculateScratchSeriesPoints,
    calculateHandicapSeriesPoints,
    calculateFantasyPoints,
  };