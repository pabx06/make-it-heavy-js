{ pkgs ? import <nixpkgs> { } }:
pkgs.mkShell {
  buildInputs = [
    pkgs.nixfmt-classic
    pkgs.typescript
    (pkgs.python3.withPackages (ps:
      with ps; [
        openai
        requests
        beautifulsoup4
        pyyaml
        duckduckgo-search
      ]))
  ];
}
