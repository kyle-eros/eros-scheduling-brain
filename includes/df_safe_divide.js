// Function for safe division to avoid divide by zero errors
function df_safe_divide(numerator, denominator) {
  return `SAFE_DIVIDE(${numerator}, ${denominator})`;
}

// Make function available globally
global.df_safe_divide = df_safe_divide;