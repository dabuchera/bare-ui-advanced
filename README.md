# bare-ui-advanced

Single and multiple select prompts for interactive CLIs.

```
npm i bare-ui-advanced
```

## Usage

``` js
const selection = require("bare-ui-advanced");

process.stdin.setRawMode(true);

const sl = selection.createInterface({
  input: process.stdin,
  output: process.stdout,
  options: ["foo", "bar", "baz"],
});

sl.on("selection", (selection) => {
  console.log("The user selected: " + (selection ? selection : "nothing"));
  process.exit();
});

sl.on("close", () => {
  console.log("Exiting...");
  process.exit();
});
```
## Output

``` 
[ ] foo
[*] bar
[ ] baz

Selected option: bar

The user selected: bar
```

## License

Apache-2.0
