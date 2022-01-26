import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import image from '@rollup/plugin-image';
import copy from '@guanghechen/rollup-plugin-copy'

export default [{
  input: 'src/index.ts',
  output: {
    file: '../_dist/public/bundle.js',
    format: 'umd',
    sourcemap: true
  },
  // Order of plugins important
  plugins: [
    typescript(),
    resolve({
      browser:true
    }),
    commonjs(),
    image(),
    copy({
      targets: [{
        src: 'public/index.html',
        dest: `../_dist/public/`,
      },{
        src: 'public/game.html',
        dest: `../_dist/public/`,

      }
      ]
    }),
  ],
}];