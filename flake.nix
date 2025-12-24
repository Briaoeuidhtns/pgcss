{
  description = "Vite Monorepo Development Environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            nodejs_22
            pnpm
            biome
          ];

          BIOME_BINARY = "${pkgs.biome}/bin/biome";

          shellHook = ''
            echo "🚀 Vite Monorepo Environment Loaded"
            echo "Node: $(node --version)"
            echo "pnpm: $(pnpm --version)"
          '';
        };
      }
    );
}
