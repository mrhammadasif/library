<script setup lang="ts">
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <SetupNaive>
      <header>
        <h1>My Book Library</h1>
        <nav>
          <nuxt-link to="/shelves">
            <NButton>
              Shelves
            </NButton>
          </nuxt-link>
          <nuxt-link to="/books">
            <NButton>
              Books
            </NButton>
          </nuxt-link>
        </nav>
      </header>
      <NuxtPage />
      <!-- <NotificationPanel /> -->
    </SetupNaive>
  </div>
</template>

<style>
header {
  background-color: #f8f9fa;
  padding: 1rem;
  text-align: center;
  nav > * {
    margin: 0 0.2rem;
    text-decoration: none;
  }
}
</style>
