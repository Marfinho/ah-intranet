// TypeScript 6 prüft Importe, die nur eine Nebenwirkung haben (hier Stylesheets),
// und verlangt eine Deklaration dafür. Next bündelt sie; der Typ ist egal.
declare module "*.css";
