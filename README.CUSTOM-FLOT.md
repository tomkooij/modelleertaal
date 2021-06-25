Modelleertaal uses a custom flot.


Patch 1: Fix autoscale
modelleertaal issue #38
Flot PR #1730, 
 with commit tomkooij/flot/6ef52547a0049cee5ad02ef21645a035b67ffd59 merged.
This is the tomkooij:fix_autoscale branch.
(The patch is from: https://github.com/flot/flot/issues/1706)


Patch 2: Fix tickDecimals
0.25-0.5-0.75 should not be rounded to 0.3-0.5-0.8
Flot PR #17865
3e0613239c0cdccefd9460aea82713e7788257b0



How to build/create:

git clone git@github.com:flot/flot
cd flot
git remote add tomkooij git@github.com:tomkooij/flot
git fetch
git cherry-pick 6ef52547a0049cee5ad02ef21645a035b67ffd59
git cherry-pick 3e0613239c0cdccefd9460aea82713e7788257b0


npm install
npm run-script build

copy dist/es5/jquery.flot.s to modelleertaal/scripts/
