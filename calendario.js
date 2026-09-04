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

function mostrarAvisoErroGoogle() {
  if (document.getElementById("avisoErroGoogle")) return; // já mostrado, não duplica
  const aviso = document.createElement("div");
  aviso.id = "avisoErroGoogle";
  aviso.style.cssText = "background:#FDECEA; color:#8A1C1C; border:1px solid #F5C2C0; border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:13.5px; line-height:1.5;";
  aviso.innerHTML = "<b>Não foi possível conectar com o Google Agenda.</b> Isso pode acontecer se a chave da API do Google acabou de ter uma restrição de segurança configurada (pode levar alguns minutos para ativar) ou se há um problema de conexão. Se persistir depois de alguns minutos, avise o administrador do sistema.";
  const container = document.querySelector(".container") || document.body;
  container.insertBefore(aviso, container.firstChild);
}

function iniciarTelaCalendario() {
  // Atualiza botões de login/logout conforme estado atual.
  // Essa função pode rodar mais de uma vez (ex: token atrasado
  // chegando depois do fallback), por isso é segura para repetir.
  const autenticado = isGoogleAuthenticated();
  showLoginButton(!autenticado);

  // Se a inicialização da API do Google falhou (ex: chave bloqueada,
  // sem internet), mostra isso na tela em vez de deixar a pessoa
  // achando que o sistema simplesmente não faz nada.
  if (typeof googleApiErroInicializacao !== "undefined" && googleApiErroInicializacao) {
    mostrarAvisoErroGoogle();
  }

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

      const eventosFormatados = eventos.map((ev) => {
        const clientePagamento = ev.extendedProperties?.private?.clientePagamento || "";
        return {
          id: ev.id,
          // No grid do calendário, mostra "Cliente: Título" quando tiver
          // cliente/pagamento preenchido — ajuda a bater o olho sem
          // precisar abrir o evento. O título "puro" (sem esse prefixo)
          // fica guardado à parte, em extendedProps, pra reaparecer
          // certo no campo de edição.
          title: clientePagamento ? `${clientePagamento}: ${ev.summary || ""}` : (ev.summary || ""),
          start: ev.start.dateTime || ev.start.date,
          end: ev.end?.dateTime || ev.end?.date,
          extendedProps: {
            tituloOriginal: ev.summary || "",
            location: ev.location || "",
            description: ev.description || "",
            clientePagamento,
          },
        };
      });

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
  document.getElementById("eventClientePagamento").value = "";
  document.getElementById("eventEndereco").value = "";
  document.getElementById("eventDescricao").value = "";
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
  document.getElementById("eventTitle").value = event.extendedProps?.tituloOriginal ?? event.title;
  document.getElementById("eventClientePagamento").value = event.extendedProps?.clientePagamento || "";
  document.getElementById("eventEndereco").value = event.extendedProps?.location || "";
  document.getElementById("eventDescricao").value = event.extendedProps?.description || "";
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
  const clientePagamento = document.getElementById("eventClientePagamento").value.trim();
  const endereco = document.getElementById("eventEndereco").value.trim();
  const descricao = document.getElementById("eventDescricao").value.trim();
  const start = document.getElementById("eventStart").value;
  const end = document.getElementById("eventEnd").value;

  if (!title || !start || !end) {
    alert("Preencha todos os campos!");
    return;
  }

  const evento = {
    summary: title,
    location: endereco,
    description: descricao,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
    extendedProperties: { private: { clientePagamento } },
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
  const clientePagamento = document.getElementById("eventClientePagamento").value.trim();
  const endereco = document.getElementById("eventEndereco").value.trim();
  const descricao = document.getElementById("eventDescricao").value.trim();
  const start = document.getElementById("eventStart").value;
  const end = document.getElementById("eventEnd").value;

  const eventoAtualizado = {
    summary: title,
    location: endereco,
    description: descricao,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
    extendedProperties: { private: { clientePagamento } },
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