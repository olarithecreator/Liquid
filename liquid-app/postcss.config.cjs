module.exports = {
  plugins: [
    // Ensures Tailwind's nested selector syntax is handled correctly.
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    require('autoprefixer'),
  ],
}
