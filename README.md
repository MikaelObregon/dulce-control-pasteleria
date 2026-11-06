# 🍰 DulceControl — Sistema de Gestión, Costeo, Stock y Finanzas para Pastelería

Aplicación **Mobile-First (PWA)** diseñada para la administración integral de emprendimientos de pastelería artesanal (**Torta Tres Leches, Marquesa de Chocolate y Torta Volteada de Piña**, extensible a cualquier catálogo).

Combina **cálculo reactivo de costos por gramo/ml/unidad**, **simulador de precios (Precio Sugerido vs. Precio Manual)**, **control de stock e indicadores de capacidad de producción**, **agenda de pedidos y alertas de deudas**, y **control de caja con separación matemática entre el Fondo Intocable de Reposición de Mercadería y tu Ganancia Neta Libre**.

---

## ✨ Las 3 Secciones Principales de la App

### 1. 🍰 `Tortas y Precios` (Recetas + Tamaños + Calculadora Todo en Uno)
* **Recetas precargadas y 100% editables**: *Torta Tres Leches*, *Marquesa de Chocolate* y *Torta Volteada de Piña* (con opción de crear nuevos productos).
* **5 Tamaños por producto**: *Individual en Vaso (250ml)*, *Porción Triangular*, *Chica*, *Mediana* y *Grande Familiar*.
* **Cálculo de Costo Real en 3 Pilares**:
  $$\text{Costo Total} = \text{Ingredientes Escalados} + \text{Packaging Específico del Tamaño} + \%\text{ Luz/Gas/Horno}$$
* **Comparador en Vivo (Precio Sugerido vs. Tu Precio Manual)**:
  * Ajusta el deslizador de `% de ganancia` para ver el **Precio Sugerido** redondeado comercialmente.
  * O escribe **tu propio Precio Manual** (con botones rápidos `-500` / `+500`) para ver al instante cuántos `$` limpios te quedan de ganancia, qué margen real obtienes y cuánto ganas vendiendo `5`, `10` o `20` unidades.
* **📲 Copiar Lista de Precios para WhatsApp**: Copia con 1 toque todos los tamaños y precios actualizados listos para pegar en el chat con un cliente.

### 2. 🏠 `Mi Día y Caja` (Pedidos, Deudas, Separación de Fondos y Asistente)
* **Separación Automática en 2 Bolsillos**:
  1. 🔒 **Intocable (Mercadería)**: Aplica la regla financiera *"Primero Reposición"* (todo cobro o seña cubre primero el costo de los ingredientes y envases vendidos para nunca descapitalizar el negocio).
  2. ✅ **Tu Ganancia Libre**: El excedente de ganancia menos los **Gastos Operativos Extra** (*papel film, limpieza, delivery, publicidad*) y retiros personales.
* **Asistente `"¿Qué puedo gastar hoy?"`**: Simulador con semáforo (**Verde / Amarillo / Rojo**) que te responde si puedes hacer un retiro o gasto personal sin tocar el dinero de los insumos.
* **Agenda de Pedidos y Alerta Roja de Deudores**:
  * Registra cliente, teléfono, fecha/hora de entrega, señas y pagos parciales.
  * Si un pedido se marca como **Entregado** y aún tiene saldo sin pagar, se activa automáticamente la **Alerta Roja de Saldos** con botón directo a **WhatsApp** para recordar la deuda.

### 3. 🛒 `Stock e Insumos` (Alacena, Indicadores de Producción y Precios)
* **Tablero de Alacena (`Mi Stock y Alacena`)**:
  * Muestra el **dinero total guardado en mercadería**, semáforo de insumos (**En Stock**, **Queda Poco**, **Agotados**) y copia en 1 toque la lista de faltantes para ir a comprar.
  * **Indicador *"¿Cuántas Tortas puedes hacer hoy con tu Stock actual?"***: Cruza las cantidades de tu alacena contra las recetas y envases para decirte cuántas tortas *Medianas, Grandes o Individuales* puedes fabricar hoy y cuál es el insumo límite.
* **Actualización Inteligente de Precios (`Costos y Precios Paquetes`)**:
  * Calcula sola el costo por `g`, `ml` o `unidad`. Cuando cambias el precio de un paquete, **todas las recetas y tamaños se recalculan automáticamente en cascada**.

---

## ☁️ Paso a Paso: Cómo Conectar la Base de Datos Gratis en la Nube (Supabase)

La app funciona de forma **Híbrida (Offline-First + Nube)**: guarda al instante en el dispositivo y, al conectarla a **Supabase**, sincroniza en tiempo real entre tu **Teléfono** y tu **Computadora**.

1. Entra a [https://supabase.com](https://supabase.com) y crea una cuenta e inicia un **New Project** gratuito.
2. En el menú lateral izquierdo de Supabase, entra a **SQL Editor**, pega el contenido del archivo [`supabase/schema.sql`](./supabase/schema.sql) (también puedes copiarlo tocando el botón **`1. Copiar SQL`** dentro del menú `⚙️` de la app) y presiona **Run**.
3. En Supabase, ve a **Project Settings (⚙️) → API** y copia estos 2 datos:
   * **Project URL** (ej. `https://xxxx.supabase.co`)
   * **Project API Key (`anon` `public`)**
4. Abre la app **DulceControl**, toca el botón **`Local ⚙️`** arriba a la derecha, pega tu **Project URL** y tu **Anon Public Key** y presiona **"Conectar y Sincronizar Nube"**. ¡El cartel pasará a **`☁️ Nube OK`**!

---

## 📱 Paso a Paso: Cómo Tener la App Instalada en tu Teléfono 24/7 (Gratis con Vercel)

1. Sube este repositorio a tu cuenta de **GitHub**.
2. Entra a [https://vercel.com](https://vercel.com), inicia sesión con tu cuenta de GitHub y toca **"Add New Project"** → selecciona este repositorio.
3. *(Opcional)* En la sección **Environment Variables** de Vercel, agrega:
   * `VITE_SUPABASE_URL` = tu Project URL de Supabase
   * `VITE_SUPABASE_ANON_KEY` = tu Anon Public Key de Supabase
4. Presiona **Deploy**. En 1 minuto Vercel te dará el link público de tu aplicación (ej. `https://dulce-control.vercel.app`).
5. **Instalar en tu celular**:
   * **En Android (Chrome)**: Abre ese link, toca los 3 puntitos arriba a la derecha y selecciona **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
   * **En iPhone (Safari)**: Abre ese link, toca el botón **Compartir** (abajo al centro) y selecciona **"Agregar a inicio"**.

---

## 🛠️ Comandos de Desarrollo Local

```bash
# Instalar dependencias
npm install

# Levantar servidor de desarrollo
npm run dev

# Ejecutar pruebas unitarias automatizadas (Vitest)
npm test

# Compilar versión de producción
npm run build
```

