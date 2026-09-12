# Cómo redesplegar el frontend (Medianube)

La app ya está corriendo en la EC2 (Next.js + PM2 + Nginx). Cuando haya cambios en el repo, seguir estos pasos.

Requisitos: la clave `.pem`, la IP pública de la EC2 y que tu IP esté habilitada en el security group (puertos 22 y 80).

---

## 1. Conectarte por SSH

```powershell
ssh -i "RUTA\A\TU-CLAVE.pem" ubuntu@IP-PUBLICA
```


---

## 2. Ir a la carpeta del frontend

```bash
cd ~/Medianube/frontend
```

---

## 3. Bajar los últimos cambios

```bash
git pull
```

---

## 4. Instalar dependencias

```bash
npm ci
```

Si no hay `package-lock.json` o `npm ci` falla:

```bash
npm install
```

---

## 5. Compilar

```bash
npm run build
```

Tiene que terminar con **Compiled successfully**.

Si el proceso muere con `Killed`, la instancia se quedó sin RAM. Activá swap (solo hace falta una vez) y volvé a buildear:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
npm run build
```

Si cambiaste variables `NEXT_PUBLIC_*` en `.env`, hay que volver a hacer este build. `dev` no se usa en la EC2.

---

## 6. Reiniciar la app

```bash
pm2 restart medianube
pm2 status
```

El proceso `medianube` tiene que quedar **online**. Nginx no se toca: sigue mandando el puerto 80 al 3000.

---

## 7. Verificar

En el navegador: `http://IP-PUBLICA`

Opcional, dentro de la EC2:

```bash
curl -I http://localhost:3000
curl -I http://127.0.0.1
```

---

## Comandos de un saque (si ya tenés swap y dependencias)

```bash
cd ~/Medianube/frontend
git pull
npm ci
npm run build
pm2 restart medianube
```

---

## Si algo falla

| Qué ves | Qué revisar |
|---|---|
| SSH no conecta / timeout | Security group, puerto 22, y si cambió tu IP (en AWS: *My IP*) |
| `Permission denied (publickey)` | Ruta de la `.pem` o usuario (`ubuntu` vs `ec2-user`) |
| La web no carga | Puerto 80 en el security group (también con tu IP actual) |
| `502 Bad Gateway` | `pm2 status` y `pm2 logs medianube` |
| `npm run build` → `Killed` | Swap (paso 5) |

Logs útiles:

```bash
pm2 logs medianube
sudo systemctl status nginx
```
