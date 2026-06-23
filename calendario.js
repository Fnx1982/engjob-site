// ===== calendario.js =====
// A autenticação com o Google agora é centralizada em google-auth.js.
// Este arquivo cuida apenas do calendário visual (FullCalendar) e
// das chamadas de criar/editar/excluir eventos.

let calendar;
let eventoSelecionado = null;

function showLoginButton(show) {
  document.getElementById("btnLogin").style.display = show ? "block" : "none";
  document.getElementById("btnLogout").style.display = show ? "none" : "block";
}

function iniciarTelaCalendario() {
  // Atualiza botões de login/logout conforme estado atual.
  // Essa função pode rodar mais de uma vez (ex: token atrasado
  // chegando depois do fallback), por isso é segura para repetir.
  const autenticado = isGoogleAuthenticated();
  console.log("[calendario] iniciarTelaCalendario() chamado. autenticado =", autenticado, "token:", gapi.client && gapi.client.getToken());
  showLoginButton(!autenticado);

  if (autenticado) {
    listarEventos();
  }

  // Botão de login interativo (abre popup do Google)
  const btnLogin = document.getElementById("btnLogin");
  btnLogin.onclick = () => {
    googleLoginInterativo(() => {
      showLoginButton(false);
      listarEventos();
    });
  };

  // Botão de logout
  const btnLogout = document.getElementById("btnLogout");
  btnLogout.onclick = () => {
    googleLogout(() => {
      showLoginButton(true);
      if (calendar) calendar.removeAllEvents();
    });
  };

  // Inicializa o calendário visual (uma única vez)
  if (!calendar) {
    const calendarEl = document.getElementById("calendar");
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "pt-br",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      dateClick: (info) => abrirModalNovo(info.dateStr),
      eventClick: (info) => abrirModalEditar(info.event),
      events: [],
    });
    calendar.render();
  }
}

// ===== Funções para manipular eventos =====

function listarEventos() {
  if (!isGoogleAuthenticated()) return;

  gapi.client.calendar.events
    .list({
      calendarId: "primary",
      timeMin: new Date(new Date().getFullYear(), 0, 1).toISOString(),
      timeMax: new Date(new Date().getFullYear() + 1, 0, 1).toISOString(),
      showDeleted: false,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 200,
    })
    .then((response) => {
      const eventos = response.result.items || [];

      const eventosFormatados = eventos.map((ev) => ({
        id: ev.id,
        title: ev.summary,
        start: ev.start.dateTime || ev.start.date,
        end: ev.end?.dateTime || ev.end?.date,
      }));

      calendar.removeAllEvents();
      calendar.addEventSource(eventosFormatados);
    })
    .catch((err) => {
      console.error("Erro ao buscar eventos:", err);
    });
}

function abrirModalNovo(data) {
  eventoSelecionado = null;
  document.getElementById("eventTitle").value = "";
  document.getElementById("eventStart").value = data + "T09:00";
  document.getElementById("eventEnd").value = data + "T10:00";
  document.querySelector("#eventModal h3").textContent = "Novo Evento";
  document.getElementById("btnSalvar").style.display = "block";
  document.getElementById("btnEditar").style.display = "none";
  document.getElementById("btnExcluir").style.display = "none";
  document.getElementById("eventModal").style.display = "flex";
}

function abrirModalEditar(event) {
  eventoSelecionado = event;
  document.getElementById("eventTitle").value = event.title;
  document.getElementById("eventStart").value = event.startStr.slice(0, 16);
  document.getElementById("eventEnd").value = event.endStr ? event.endStr.slice(0, 16) : "";
  document.querySelector("#eventModal h3").textContent = "Editar Evento";
  document.getElementById("btnSalvar").style.display = "none";
  document.getElementById("btnEditar").style.display = "block";
  document.getElementById("btnExcluir").style.display = "block";
  document.getElementById("eventModal").style.display = "flex";
}

function fecharModal() {
  document.getElementById("eventModal").style.display = "none";
}

function salvarEvento() {
  const title = document.getElementById("eventTitle").value;
  const start = document.getElementById("eventStart").value;
  const end = document.getElementById("eventEnd").value;

  if (!title || !start || !end) {
    alert("Preencha todos os campos!");
    return;
  }

  const evento = {
    summary: title,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
  };

  gapi.client.calendar.events
    .insert({
      calendarId: "primary",
      resource: evento,
    })
    .then(() => {
      fecharModal();
      listarEventos();
    })
    .catch((err) => {
      console.error("Erro ao criar evento:", err);
      alert("Erro ao criar evento.");
    });
}

function editarEvento() {
  if (!eventoSelecionado) return;

  const title = document.getElementById("eventTitle").value;
  const start = document.getElementById("eventStart").value;
  const end = document.getElementById("eventEnd").value;

  const eventoAtualizado = {
    summary: title,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
  };

  gapi.client.calendar.events
    .update({
      calendarId: "primary",
      eventId: eventoSelecionado.id,
      resource: eventoAtualizado,
    })
    .then(() => {
      fecharModal();
      listarEventos();
    })
    .catch((err) => {
      console.error("Erro ao editar evento:", err);
      alert("Erro ao editar evento.");
    });
}

function excluirEvento() {
  if (!eventoSelecionado) return;

  gapi.client.calendar.events
    .delete({
      calendarId: "primary",
      eventId: eventoSelecionado.id,
    })
    .then(() => {
      fecharModal();
      listarEventos();
    })
    .catch((err) => {
      console.error("Erro ao excluir evento:", err);
      alert("Erro ao excluir evento.");
    });
}