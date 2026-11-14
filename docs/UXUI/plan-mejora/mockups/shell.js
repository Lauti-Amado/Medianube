// Arma el sidebar compartido y aplica los modos ?clean (sin marcadores) y ?modal (muestra el popup).
(function () {
  var q = location.search;
  if (q.indexOf("clean") !== -1) document.body.classList.add("clean");
  if (q.indexOf("modal") !== -1) document.body.classList.add("modal");

  // Gráfico histórico vs predicción: <div class="chart" data-hist data-pred data-labels data-h data-vals="peak|all">
  document.querySelectorAll(".chart[data-hist]").forEach(function (ch) {
    var hist = ch.dataset.hist.split(",").map(Number);
    var pred = ch.dataset.pred.split(",").map(Number);
    var labels = ch.dataset.labels.split(",");
    var H = Number(ch.dataset.h);
    var mode = ch.dataset.vals || "peak";
    var all = hist.concat(pred);
    var max = Math.max.apply(null, all);
    var pk = hist.length + pred.indexOf(Math.max.apply(null, pred));
    var today = hist.length - 1;
    ch.style.height = H + 20 + "px";
    var html = "";
    [33, 66].forEach(function (p) {
      html += '<div class="grid" style="bottom:' + (p * H) / 100 + 'px"></div>';
    });
    all.forEach(function (v, i) {
      var show = mode === "all" || i === pk;
      html +=
        '<div class="c">' +
        (i === today ? '<div class="today"></div>' : "") +
        (show ? '<div class="val' + (i === pk ? " pk" : "") + '">' + v + "</div>" : "") +
        '<div class="bar' + (i >= hist.length ? " p" : "") + '" style="height:' + Math.round((v / max) * H) + 'px"></div></div>';
    });
    ch.innerHTML = html;
    var xl = document.createElement("div");
    xl.className = "xl";
    xl.innerHTML = labels
      .map(function (l, i) {
        return '<span class="' + (i === today ? "hoy" : "") + '">' + l + (i === today ? " · hoy" : "") + "</span>";
      })
      .join("");
    ch.parentNode.insertBefore(xl, ch.nextSibling);
  });

  var aside = document.querySelector("aside.sidebar");
  if (!aside) return;
  var active = aside.getAttribute("data-active");
  var pinConfig = aside.getAttribute("data-pin-config");
  var items = [
    ["dashboard", "Dashboard", "grid_view"],
    ["compras", "Compras", "receipt_long"],
    ["precios", "Precios", "sell"],
    ["demanda", "Demanda", "trending_up"],
  ];
  var nav = items
    .map(function (i) {
      return (
        '<div class="sb-item' + (i[0] === active ? " on" : "") + '"><span class="ms">' + i[2] + "</span>" + i[1] + "</div>"
      );
    })
    .join("");
  var cfgOn = active === "configuracion";
  aside.innerHTML =
    '<div class="sb-brand"><img src="../../../../frontend/public/medianube-logo.jpeg" alt="medianube"><span>medianube</span></div>' +
    '<div class="sb-cta"><span class="ms">upload_file</span>subir factura</div>' +
    '<div class="sb-div"></div>' +
    '<nav class="sb-nav">' + nav + "</nav>" +
    '<div class="sb-bottom">' +
    '<div class="sb-item' + (cfgOn ? " on" : "") + '">' +
    (pinConfig ? '<span class="pin r">' + pinConfig + "</span>" : "") +
    '<span class="ms">settings</span>Configuración</div>' +
    '<div class="sb-item"><span class="ms">logout</span>Cerrar sesión</div>' +
    "</div>";
})();
