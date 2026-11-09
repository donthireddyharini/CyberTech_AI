# Google Project IDX & Google AI Studio configuration
# See: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nodejs_20
  ];
  env = {
    PORT = "5173";
  };
  idx = {
    extensions = [
      "ms-python.python"
    ];
    workspace = {
      onCreate = {
        npm-install = "npm --prefix sentinel-frontend install";
        pip-install = "pip install -r sentinel-backend/requirements.txt";
      };
      onStart = {
        start-backend = "python -m uvicorn main:app --app-dir sentinel-backend --host 0.0.0.0 --port 8001 &";
        start-frontend = "npm --prefix sentinel-frontend run dev -- --host 0.0.0.0 --port 5173";
      };
    };
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "--prefix" "sentinel-frontend" "run" "dev" "--" "--host" "0.0.0.0" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}
